#!/usr/bin/env node
// Gentle pentatonic "music box / guzheng pluck" loop, synthesized sample by
// sample in Node (seeded, deterministic), then encoded with ffmpeg.
//   node scripts/bgm.mjs  ->  audio/bgm.wav (48 kHz stereo s16) + audio/bgm.m4a
//
// Musical layout: 75 BPM, 4/4, 20 bars = exactly 64.000 s, so the loop is bar-aligned.
// The last 2 bars are a cadence then rest, the final second fades to silence
// and the track starts from silence, so the loop point never clicks.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, FFMPEG, probeDuration } from './lib/audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);

const SR = 48000;
const BPM = 75;
const BEAT = 60 / BPM;            // 0.8 s
const EIGHTH = BEAT / 2;          // 0.4 s
const BARS = 20;
const BAR = BEAT * 4;             // 3.2 s
const LENGTH = BARS * BAR;        // 64.0 s
const N = Math.round(LENGTH * SR);
const PEAK_DBFS = -20;
const FADE_OUT = 1.0;             // s, end of loop
const SEED = 0x9e0b2026;
const PAD_LEVEL = 0.09;           // drone sits ~6 dB under the plucks

// ---------- seeded PRNG (mulberry32) ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function weighted(pairs) { // [[value, weight], ...]
  let r = rnd() * pairs.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs.at(-1)[0];
}

// ---------- pitch material: C major pentatonic, two octaves (C4..A5) ----------
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const dB = (x) => 10 ** (x / 20);

// ---------- buffers ----------
const L = new Float64Array(N + SR * 4);
const R = new Float64Array(N + SR * 4);

/** Pluck: partials 1x, 2x (-12 dB), 3x (-20 dB); 4 ms attack; exponential decay
 *  (fundamental tau 0.45 s, i.e. about -23 dB at 1.2 s; upper partials faster); tiny onset pitch settle. */
function pluck(t0, midi, vel, pan) {
  const f = mtof(midi);
  const start = Math.round(t0 * SR);
  const len = Math.round(3.2 * SR);
  const gL = Math.cos((pan + 1) * Math.PI / 4), gR = Math.sin((pan + 1) * Math.PI / 4);
  // brighter notes a little softer, so nothing gets piercing
  const amp = vel * (1 - 0.3 * (midi - 60) / 21);
  const a2 = dB(-12), a3 = dB(-20);
  const tau1 = 0.45, tau2 = 0.30, tau3 = 0.20;
  const att = 0.004 * SR;
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const bend = 1 + 0.003 * Math.exp(-t / 0.03);       // guzheng-like settle into pitch
    ph += (2 * Math.PI * f * bend) / SR;
    const a = n < att ? Math.sin((n / att) * Math.PI / 2) : 1;
    const s = a * (Math.sin(ph) * Math.exp(-t / tau1)
      + a2 * Math.sin(2 * ph) * Math.exp(-t / tau2)
      + a3 * Math.sin(3 * ph) * Math.exp(-t / tau3));
    const i = start + n;
    L[i] += s * amp * gL;
    R[i] += s * amp * gR;
  }
}

/** Soft drone pad: root + fifth, slightly detuned pairs, slow sine-shaped swell. */
function pad(t0, dur, midis, vel) {
  const start = Math.round(t0 * SR);
  const attack = 1.6, release = 2.0;
  const len = Math.round((dur + release) * SR);
  for (const [k, m] of midis.entries()) {
    const f = mtof(m);
    const det = [1, 1.0025];
    const spread = k % 2 ? [0.62, 0.78] : [0.78, 0.62];
    for (let n = 0; n < len; n++) {
      const t = n / SR;
      let env;
      if (t < attack) env = Math.sin((t / attack) * Math.PI / 2) ** 2;
      else if (t < dur) env = 1;
      else env = Math.cos(((t - dur) / release) * Math.PI / 2) ** 2;
      const w = 2 * Math.PI * f * t;
      const s = env * vel * (Math.sin(w * det[0]) + Math.sin(w * det[1]) + dB(-16) * Math.sin(2 * w)) / 2;
      const i = start + n;
      L[i] += s * spread[0];
      R[i] += s * spread[1];
    }
  }
}

// ---------- composition ----------
// Chords per 2-bar unit (10 units); the loop ends on C and restarts on C.
const CHORDS = {
  C: { pad: [48, 55], tones: [60, 64, 67, 72, 76, 79] },
  Am: { pad: [45, 52], tones: [60, 64, 69, 72, 76, 81] },
  Dm: { pad: [50, 57], tones: [62, 69, 74, 81] },
  G: { pad: [43, 50], tones: [62, 67, 74, 79] },
};
const UNITS = ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'G', 'C', 'Am', 'C'];

// One-bar rhythms in eighth notes (negative = rest), each summing to 8.
const RHYTHMS = [[2, 2, 2, 2], [3, 1, 2, 2], [2, 2, 4], [4, -2, 2], [2, -2, 2, 2], [1, 1, 2, 4], [-4, 2, 2], [-2, 2, 4], [4, 4], [2, 1, 1, 4]];
const CADENCE = [[2, 2, 4], [4, 4], [1, 1, 2, 4], [-2, 2, 4], [6, -2], [4, -4]];

function makePhrase(startIdx) {
  // returns [{ beat8, dur8, idx }] across 2 bars (16 eighths)
  const notes = [];
  let idx = startIdx;
  for (let bar = 0; bar < 2; bar++) {
    const rhythm = bar === 0 ? pick(RHYTHMS) : pick(CADENCE);
    let pos = bar * 8;
    for (const d of rhythm) {
      if (d > 0) {
        notes.push({ beat8: pos, dur8: d, idx });
        const step = weighted([[-2, 1], [-1, 3], [0, 1], [1, 3], [2, 1]]);
        idx += step;
        if (idx < 1) idx = 2 - idx;          // reflect inside the two octaves
        if (idx > 8) idx = 16 - idx;
      }
      pos += Math.abs(d);
    }
  }
  return notes;
}
const shift = (ph, k) => ph.map((n) => ({ ...n, idx: Math.min(9, Math.max(0, n.idx + k)) }));

const P0 = makePhrase(5), P1 = makePhrase(7), P2 = makePhrase(4), P3 = makePhrase(6);
const ARRANGEMENT = [P0, P1, shift(P0, 1), P2, P1, P3, shift(P0, -1), P2, shift(P1, -1), null];

// Snap a phrase's last note onto a chord tone so each unit resolves.
function snapToChord(midi, chord) {
  const tones = CHORDS[chord].tones;
  return tones.reduce((b, t) => (Math.abs(t - midi) < Math.abs(b - midi) ? t : b), tones[0]);
}

const events = [];
ARRANGEMENT.forEach((phrase, u) => {
  const t0 = u * 2 * BAR;
  const chord = UNITS[u];
  pad(t0, 2 * BAR, CHORDS[chord].pad, PAD_LEVEL);
  if (!phrase) return;
  phrase.forEach((n, k) => {
    let midi = SCALE[n.idx];
    const last = k === phrase.length - 1;
    if (last) midi = snapToChord(midi, chord);
    const t = t0 + n.beat8 * EIGHTH;
    const accent = n.beat8 % 8 === 0 ? 0.08 : n.beat8 % 2 === 0 ? 0.03 : 0;
    const vel = 0.5 + accent + rnd() * 0.12;
    events.push({ t, midi, vel, pan: (rnd() - 0.5) * 0.6 });
    // soft lower harmony (a pentatonic "third" below) on long notes
    if (n.dur8 >= 4 && rnd() < 0.55) {
      const si = SCALE.indexOf(midi);
      if (si >= 2) events.push({ t: t + 0.012, midi: SCALE[si - 2], vel: vel * 0.45, pan: -0.2 });
    }
  });
  // guzheng-style grace sweep into some phrase starts
  if (u > 0 && rnd() < 0.5) {
    const first = phrase[0];
    const si = first.idx;
    for (let g = 3; g >= 1; g--) {
      if (si - g < 0) continue;
      events.push({ t: t0 + first.beat8 * EIGHTH - g * 0.055, midi: SCALE[si - g], vel: 0.2, pan: 0.25 });
    }
  }
});
// Final unit (bars 19-20): a calm cadence E5 -> C5 (+G4), then rest into the fade.
{
  const t0 = 9 * 2 * BAR;
  events.push({ t: t0, midi: 76, vel: 0.5, pan: 0.1 });
  events.push({ t: t0 + 4 * EIGHTH, midi: 72, vel: 0.52, pan: -0.05 });
  events.push({ t: t0 + 4 * EIGHTH + 0.012, midi: 67, vel: 0.22, pan: -0.25 });
}
for (const e of events) if (e.t >= 0) pluck(e.t, e.midi, e.vel, e.pan);

// ---------- reverb: small Schroeder/Freeverb-style feedback-delay network ----------
function reverb(x, offset) {
  const scale = SR / 44100;
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d + offset) * scale));
  const aps = [556, 441].map((d) => Math.round((d + offset) * scale));
  const fb = 0.8, damp = 0.35;
  const out = new Float64Array(x.length);
  for (const d of combs) {
    const buf = new Float64Array(d); let idx = 0, lp = 0;
    for (let n = 0; n < x.length; n++) {
      const y = buf[idx];
      lp = y * (1 - damp) + lp * damp;          // damping low-pass in the loop
      buf[idx] = x[n] + lp * fb;
      out[n] += y / combs.length;
      idx = (idx + 1) % d;
    }
  }
  for (const d of aps) {
    const buf = new Float64Array(d); let idx = 0;
    for (let n = 0; n < x.length; n++) {
      const b = buf[idx];
      const v = out[n] + b * 0.5;
      buf[idx] = v;
      out[n] = b - v * 0.5;
      idx = (idx + 1) % d;
    }
  }
  return out;
}
const WET = 0.32;
const wl = reverb(L, 0), wr = reverb(R, 23);

// ---------- master: mix, fades, normalize, dither ----------
const out = [new Float64Array(N), new Float64Array(N)];
const fadeN = Math.round(FADE_OUT * SR), fadeInN = Math.round(0.02 * SR);
for (let n = 0; n < N; n++) {
  let g = 1;
  if (n >= N - fadeN) g = Math.cos(((n - (N - fadeN)) / fadeN) * Math.PI / 2) ** 2; // raised-cosine fade to 0
  if (n < fadeInN) g *= Math.sin((n / fadeInN) * Math.PI / 2) ** 2;
  out[0][n] = (L[n] + WET * wl[n]) * g;
  out[1][n] = (R[n] + WET * wr[n]) * g;
}
let peak = 0;
for (const ch of out) for (const v of ch) peak = Math.max(peak, Math.abs(v));
const gain = dB(PEAK_DBFS) / peak;
const pcm = Buffer.alloc(N * 4);
const drnd = mulberry32(SEED ^ 0x5bd1e995);
let rms = 0, outPeak = 0;
for (let n = 0; n < N; n++) {
  for (let c = 0; c < 2; c++) {
    const v = out[c][n] * gain;
    rms += v * v; outPeak = Math.max(outPeak, Math.abs(v));
    const dither = (drnd() - drnd()) / 32768;               // TPDF, 1 LSB
    const s = Math.max(-32768, Math.min(32767, Math.round((v + dither) * 32767)));
    pcm.writeInt16LE(n === N - 1 || n === 0 ? 0 : s, (n * 2 + c) * 2);
  }
}
rms = Math.sqrt(rms / (2 * N));

// ---------- write WAV + encode ----------
function wavHeader(bytes, rate, ch) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(bytes, 40);
  return h;
}
await fs.mkdir(P('audio'), { recursive: true });
await fs.writeFile(P('audio/bgm.wav'), Buffer.concat([wavHeader(pcm.length, SR, 2), pcm]));
await run(FFMPEG, ['-hide_banner', '-nostats', '-y', '-i', P('audio/bgm.wav'), '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', P('audio/bgm.m4a')]);

// Loop-seam check: the last and first 10 ms must be near silence.
const edge = Math.round(0.01 * SR);
let seam = 0;
for (let n = 0; n < edge; n++) for (let c = 0; c < 2; c++) {
  seam = Math.max(seam, Math.abs(pcm.readInt16LE((n * 2 + c) * 2)), Math.abs(pcm.readInt16LE(((N - 1 - n) * 2 + c) * 2)));
}
const [dWav, dM4a] = await Promise.all([probeDuration(P('audio/bgm.wav')), probeDuration(P('audio/bgm.m4a'))]);
const toDb = (x) => (20 * Math.log10(x)).toFixed(1);
const stats = {
  length: LENGTH, wav: dWav, m4a: dM4a, peakDbfs: toDb(outPeak), rmsDbfs: toDb(rms),
  seamDbfs: seam ? toDb(seam / 32768) : '-inf', notes: events.length,
};
console.log(`bgm: ${LENGTH.toFixed(3)} s loop, ${events.length} plucks + ${UNITS.length} pads, ` +
  `peak ${stats.peakDbfs} dBFS, RMS ${stats.rmsDbfs} dBFS, loop-edge max ${stats.seamDbfs} dBFS`);
console.log(`     audio/bgm.wav ${dWav.toFixed(3)} s, audio/bgm.m4a ${dM4a.toFixed(3)} s`);

// Keep docs/AUDIO.md's BGM section in sync.
const doc = P('docs/AUDIO.md');
if (existsSync(doc)) {
  const B = '<!-- BGM:BEGIN -->', E = '<!-- BGM:END -->';
  const s = await fs.readFile(doc, 'utf8');
  const a = s.indexOf(B), b = s.indexOf(E);
  if (a >= 0 && b > a) {
    const body = [
      `- C major pentatonic (C D E G A, C4 to A5), **${BPM} BPM**, 4/4, ${BARS} bars = **${LENGTH.toFixed(3)} s** exactly. The tempo was nudged from about 72 to 75 BPM so that the loop is bar-aligned. Seeded PRNG (mulberry32, seed \`0x${SEED.toString(16)}\`), so every run gives the same file.`,
      '- Pluck timbre: sine partials 1× + 2× (-12 dB) + 3× (-20 dB), 4 ms attack, exponential decay (fundamental τ = 0.45 s; upper partials decay faster), plus a 0.3 % onset pitch settle for a guzheng feel. Brighter notes are played a little softer. The highest partial is about 2.6 kHz, so nothing is harsh.',
      '- Melody: four seeded 2-bar phrases (random walk over the scale, rests included) arranged A B A′ C | B D A″ C | B′ cadence. Each phrase ends on a chord tone; some long notes get a soft lower harmony; some phrases start with a guzheng-style 3-note grace sweep.',
      '- Drone pad: root + fifth (C, Am, Dm, G), slightly detuned sine pairs, 1.6 s swell and 2 s release, one pad per 2 bars.',
      `- Reverb: Freeverb-style feedback-delay network (4 damped combs, feedback 0.8, plus 2 all-passes per channel, offset for stereo), wet ${WET}.`,
      `- Loop: the last 2 bars are a cadence followed by rest, the final ${FADE_OUT} s fades to silence (raised cosine) and the track starts from silence. The largest sample in the first and last 10 ms is ${stats.seamDbfs} dBFS, so the loop does not click.`,
      `- Level: peak **${stats.peakDbfs} dBFS**, RMS ${stats.rmsDbfs} dBFS. It is meant to sit under the narration at about 0.25 volume.`,
      `- Files: \`audio/bgm.wav\` (48 kHz stereo s16, ${dWav.toFixed(3)} s) and \`audio/bgm.m4a\` (AAC 128k, ${dM4a.toFixed(3)} s; AAC adds encoder padding, so use the WAV or WebAudio when a sample-exact loop matters).`,
    ].join('\n');
    await fs.writeFile(doc, s.slice(0, a + B.length) + '\n' + body + '\n' + s.slice(b));
  }
}
