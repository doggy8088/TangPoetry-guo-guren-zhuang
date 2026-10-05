#!/usr/bin/env node
// Narration pipeline: Gemini TTS -> QA (transcribe + compare) -> trim/loudnorm ->
// script/timeline.json -> audio/narration.m4a + .mp3 -> docs/AUDIO.md QA table.
//
//   node scripts/tts.mjs                 # generate what is missing or changed
//   node scripts/tts.mjs --force         # regenerate everything
//   node scripts/tts.mjs --only s1-3,v04 # regenerate just these (cue ids, vNN or vocab words)
//   node scripts/tts.mjs --concurrency 2
// A cue or vocab entry may carry "tts_text": the text actually spoken/QA-checked (e.g. 霞 for 斜 to
// force the xiá reading) while "text" stays as displayed on screen and in timeline.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesize, transcribe, toPinyin, ttsPrompt, redact, TTS_MODEL, STT_MODEL } from './lib/gemini.mjs';
import { processClip, qaCopy, probeDuration, readWav, mixAtOffsets, encodeM4a, encodeMp3, CLIP_RATE } from './lib/audio.mjs';
import { evaluate, pinyinSimilarity, pinyinPrefixSimilarity, HEAD_SECONDS, HEAD_PROMPT, HEAD_MIN_PREFIX_SIM } from './lib/qa.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const MAX_ATTEMPTS = 4;
const THRESHOLD = { cue: 0.85, vocab: 0.75 };
const round3 = (x) => Math.round(x * 1000) / 1000;

// ---------- CLI ----------
function parseArgs(argv) {
  const o = { force: false, only: null, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') o.force = true;
    else if (a === '--only') o.only = argv[++i];
    else if (a.startsWith('--only=')) o.only = a.slice(7);
    else if (a === '--concurrency') o.concurrency = Number(argv[++i]);
    else if (a.startsWith('--concurrency=')) o.concurrency = Number(a.slice(14));
    else if (a === '-h' || a === '--help') { console.log('usage: node scripts/tts.mjs [--force] [--only id,id] [--concurrency N]'); process.exit(0); }
    else throw new Error(`unknown argument: ${a}`);
  }
  if (o.only != null) o.only = new Set(o.only.split(',').map((s) => s.trim()).filter(Boolean));
  if (!(o.concurrency >= 1)) o.concurrency = 4;
  return o;
}

async function pool(items, n, fn) {
  let next = 0;
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const k = next++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const writeJson = (f, v) => fs.writeFile(f, JSON.stringify(v, null, 2) + '\n');

// ---------- jobs ----------
function buildJobs(narr) {
  const jobs = [];
  for (const c of narr.cues) {
    const sp = narr.speakers[c.speaker];
    if (!sp) throw new Error(`cue ${c.id}: unknown speaker ${c.speaker}`);
    jobs.push({
      kind: 'cue', id: c.id, keys: [c.id], text: c.tts_text || c.text, display: c.text, speaker: c.speaker, voice: sp.voice,
      prompt: ttsPrompt(sp.direction, c.tts_text || c.text), threshold: THRESHOLD.cue,
      rel: `audio/cues/${c.id}.wav`, sidecar: P('audio/cues', `${c.id}.json`),
    });
  }
  const sp = narr.speakers['旁白'];
  narr.vocab.forEach((v, i) => {
    const nn = String(i).padStart(2, '0');
    const text = v.tts_text || `「${v.word}」，${v.meaning}。`;
    jobs.push({
      kind: 'vocab', id: `v${nn}`, keys: [`v${nn}`, v.word], word: v.word, text, speaker: '旁白', voice: sp.voice,
      prompt: ttsPrompt(sp.direction, text), threshold: THRESHOLD.vocab,
      rel: `audio/vocab/${nn}.wav`, sidecar: P('audio/vocab', `${nn}.json`),
    });
  });
  return jobs;
}

async function cachedSidecar(job) {
  if (!existsSync(P(job.rel)) || !existsSync(job.sidecar)) return null;
  try { return await readJson(job.sidecar); } catch { return null; }
}
const cacheValid = (job, sc) =>
  sc && sc.text === job.text && sc.voice === job.voice && sc.prompt === job.prompt && sc.qa?.pass === true;

// ---------- one job: generate + QA loop ----------
async function generate(job, tmp, log) {
  const history = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const base = path.join(tmp, `${job.id}.a${attempt}`);
    try {
      const wav = await synthesize({ prompt: job.prompt, voice: job.voice, log });
      await fs.writeFile(`${base}.raw.wav`, wav);
      const { duration } = await processClip(`${base}.raw.wav`, `${base}.wav`);
      const headCoversClip = duration <= HEAD_SECONDS;
      await Promise.all([
        qaCopy(`${base}.wav`, `${base}.qa.wav`),
        qaCopy(`${base}.wav`, `${base}.head.wav`, { seconds: HEAD_SECONDS }),
      ]);
      const [full, head] = await Promise.all([fs.readFile(`${base}.qa.wav`), fs.readFile(`${base}.head.wav`)]);
      const [transcript, headTranscript] = await Promise.all([
        transcribe(full, { log }),
        transcribe(head, { prompt: HEAD_PROMPT, log }),
      ]);
      const qaIn = { text: job.text, transcript, headTranscript, headCoversClip, duration, threshold: job.threshold };
      let ev = evaluate(qaIn);
      // Homophone-aware fallback: if a character-level score misses (full
      // similarity or head prefix), compare toneless pinyin syllables instead.
      const charMiss = ev.sim < job.threshold || (ev.headSim != null && ev.headSim < HEAD_MIN_PREFIX_SIM);
      if (!ev.pass && charMiss && !ev.telltale.length && ev.rateOk && !ev.reasons.some((r) => r.startsWith('head telltale'))) {
        try {
          const py = await toPinyin({ ref: job.text, t: transcript, h: headTranscript }, { log });
          const pinyinSim = Math.max(pinyinSimilarity(py.ref, py.t), headCoversClip ? pinyinSimilarity(py.ref, py.h) : 0);
          const headPinyinSim = pinyinPrefixSimilarity(py.h, py.ref);
          ev = evaluate({ ...qaIn, pinyinSim, headPinyinSim });
        } catch (e) { log(`  ${job.id.padEnd(6)} pinyin check skipped: ${redact(e.message).slice(0, 120)}`); }
      }
      history.push({ attempt, file: `${base}.wav`, duration, transcript, headTranscript, ...ev });
      log(`  ${job.id.padEnd(6)} a${attempt} ${ev.pass ? 'PASS' : 'fail'} sim=${ev.sim.toFixed(3)}${ev.pinyinSim != null ? ` (char ${ev.charSim.toFixed(3)}, pinyin ${ev.pinyinSim.toFixed(3)})` : ''} ` +
        `len=${ev.lenRatio.toFixed(2)} ${duration.toFixed(2)}s${ev.pass ? '' : '  <- ' + ev.reasons.join('; ')}`);
      // A cue that passes only via the pinyin fallback may contain a real
      // mispronunciation (e.g. 開軒 heard as tái xuān), so keep trying for a take
      // that also passes at character level; the best take is chosen below.
      const strict = ev.pass && ev.charSim >= job.threshold;
      if (strict || (ev.pass && job.kind === 'vocab')) break;
    } catch (e) {
      history.push({ attempt, error: redact(e.message), score: -Infinity, pass: false });
      log(`  ${job.id.padEnd(6)} a${attempt} ERROR ${redact(e.message).slice(0, 200)}`);
    }
  }
  const ok = history.filter((h) => !h.error);
  if (!ok.length) throw new Error(`${job.id}: all ${MAX_ATTEMPTS} attempts errored`);
  const strictOf = (h) => h.pass && h.charSim >= job.threshold;
  const best = ok.slice().sort((a, b) => (b.pass - a.pass) || (strictOf(b) - strictOf(a))
    || (b.charSim - a.charSim) || (b.score - a.score))[0];
  await fs.copyFile(best.file, P(job.rel));
  const duration = await probeDuration(P(job.rel));
  const sidecar = {
    id: job.id, kind: job.kind, ...(job.word ? { word: job.word } : {}),
    text: job.text, ...(job.display && job.display !== job.text ? { display: job.display } : {}), speaker: job.speaker, voice: job.voice, prompt: job.prompt, model: TTS_MODEL,
    audio: job.rel, duration, generatedAt: new Date().toISOString(),
    qa: {
      pass: best.pass, threshold: job.threshold, sim: round3(best.sim), charSim: round3(best.charSim),
      pinyinSim: best.pinyinSim == null ? null : round3(best.pinyinSim), lenRatio: round3(best.lenRatio),
      headSim: best.headSim == null ? null : round3(best.headSim), rateOk: best.rateOk, reasons: best.reasons,
      transcript: best.transcript, headTranscript: best.headTranscript,
      attempts: history.length, chosenAttempt: best.attempt, transcriber: STT_MODEL,
      history: history.map((h) => h.error
        ? { attempt: h.attempt, error: h.error }
        : { attempt: h.attempt, pass: h.pass, sim: round3(h.sim), charSim: round3(h.charSim),
            pinyinSim: h.pinyinSim == null ? null : round3(h.pinyinSim), lenRatio: round3(h.lenRatio), duration: round3(h.duration),
            reasons: h.reasons, transcript: h.transcript, headTranscript: h.headTranscript }),
    },
  };
  await writeJson(job.sidecar, sidecar);
  return sidecar;
}

// ---------- timeline ----------
function buildTimeline(narr, durations, vocabJobs) {
  const T = narr.timing;
  const cues = [];
  let t = T.lead_in;
  narr.cues.forEach((c, i) => {
    const duration = round3(durations[c.id]);
    const start = round3(t);
    const end = round3(start + duration);
    const pause = c.pause_after || 0;
    cues.push({ id: c.id, scene: c.scene, speaker: c.speaker, text: c.text, start, end, duration,
      audio: `audio/cues/${c.id}.wav`, pause_after: pause });
    const next = narr.cues[i + 1];
    if (next) t = end + (next.scene !== c.scene ? T.gap_scene : T.gap_cue) + pause;
  });
  const total = round3(cues.at(-1).end + T.tail);
  const scenes = [];
  for (const s of narr.scenes) {
    const first = cues.find((c) => c.scene === s.id);
    if (!first) continue;
    // The first scene starts at 0 so that scenes tile [0, total] with no gap.
    scenes.push({ id: s.id, name: s.name, start: scenes.length ? round3(Math.max(0, first.start - 0.6)) : 0, end: null });
  }
  scenes.forEach((s, i) => { s.end = i + 1 < scenes.length ? scenes[i + 1].start : total; });
  const vocab_audio = Object.fromEntries(vocabJobs.map((j) => [j.word, j.rel]));
  return { fps: 30, total, scenes, cues, vocab_audio };
}

// ---------- merge + verify ----------
async function mergeNarration(timeline, tmp, log) {
  const master = path.join(tmp, 'narration.master.wav');
  await mixAtOffsets(timeline.cues.map((c) => ({ file: P(c.audio), start: c.start })), timeline.total, master);

  // Sample-accuracy check: every clip must appear bit-exact at round(start*rate).
  const m = await readWav(master);
  const expectSamples = Math.round(timeline.total * CLIP_RATE);
  if (m.samples.length !== expectSamples) throw new Error(`master has ${m.samples.length} samples, expected ${expectSamples}`);
  let worst = 0;
  for (const c of timeline.cues) {
    const clip = (await readWav(P(c.audio))).samples;
    const off = Math.round(c.start * CLIP_RATE);
    for (let i = 0; i < clip.length; i++) worst = Math.max(worst, Math.abs(m.samples[off + i] - clip[i]));
  }
  if (worst > 1) throw new Error(`merged narration deviates from clips (max sample diff ${worst})`);
  log(`  master: ${expectSamples} samples @ ${CLIP_RATE} Hz, all ${timeline.cues.length} clips bit-exact at their start sample`);

  await Promise.all([encodeM4a(master, P('audio/narration.m4a')), encodeMp3(master, P('audio/narration.mp3'))]);
  const [dm4a, dmp3] = await Promise.all([probeDuration(P('audio/narration.m4a')), probeDuration(P('audio/narration.mp3'))]);
  const res = { total: timeline.total, m4a: dm4a, mp3: dmp3, ok: Math.abs(dm4a - timeline.total) <= 0.05 && Math.abs(dmp3 - timeline.total) <= 0.05 };
  log(`  narration.m4a ${dm4a.toFixed(3)}s, narration.mp3 ${dmp3.toFixed(3)}s, timeline total ${timeline.total}s -> ${res.ok ? 'OK' : 'MISMATCH'}`);
  if (!res.ok) throw new Error('encoded narration duration differs from timeline total by more than 0.05s');
  return res;
}

// ---------- docs/AUDIO.md ----------
const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const simCell = (q) => `${q.sim.toFixed(3)}${q.pinyinSim != null && q.pinyinSim >= q.charSim && q.pinyinSim > 0 ? ' (py)' : ''}`;
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function qaMarkdown(cueSc, vocabSc, timeline, merge) {
  const all = [...cueSc, ...vocabSc];
  const retried = all.filter((s) => s.qa.attempts > 1);
  const warns = all.filter((s) => !s.qa.pass);
  const L = [];
  L.push(`_Generated by \`scripts/tts.mjs\` on ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC._`, '');
  L.push(`- **Total narration length:** ${timeline.total.toFixed(3)} s (${fmtTime(timeline.total)}), ${timeline.cues.length} cues, ${timeline.scenes.length} scenes`);
  if (merge) L.push(`- **Merged files:** narration.m4a = ${merge.m4a.toFixed(3)} s, narration.mp3 = ${merge.mp3.toFixed(3)} s (timeline total ${timeline.total.toFixed(3)} s, tolerance ±0.05 s): ${merge.ok ? 'OK' : 'MISMATCH'}`);
  L.push(`- **Clips needing more than one attempt:** ${retried.length} of ${all.length} (${retried.map((s) => s.id).join(', ') || 'none'})`);
  L.push(`- **WARN (no attempt passed QA; best attempt kept):** ${warns.length ? warns.map((s) => s.id).join(', ') : 'none'}`, '');

  L.push('Similarity is the Levenshtein ratio of the normalized text against the transcript. **(py)** means the homophone-aware toneless-pinyin score was higher and was used.', '');
  L.push('### Cues', '', '| cue | speaker | start | duration (s) | similarity | attempts | QA |', '|---|---|---:|---:|---:|---:|---|');
  const startOf = Object.fromEntries(timeline.cues.map((c) => [c.id, c.start]));
  for (const s of cueSc) {
    L.push(`| ${s.id} | ${s.speaker} | ${startOf[s.id]?.toFixed(3) ?? ''} | ${s.duration.toFixed(3)} | ${simCell(s.qa)} | ${s.qa.attempts} | ${s.qa.pass ? 'pass' : '**WARN**'} |`);
  }
  L.push('', '### Vocabulary clips', '', '| file | word | duration (s) | similarity | attempts | QA |', '|---|---|---:|---:|---:|---|');
  for (const s of vocabSc) {
    L.push(`| ${s.audio.split('/').pop()} | ${s.word} | ${s.duration.toFixed(3)} | ${simCell(s.qa)} | ${s.qa.attempts} | ${s.qa.pass ? 'pass' : '**WARN**'} |`);
  }
  L.push('', '### WARN clips (listen and decide)', '');
  if (!warns.length) L.push('None: every clip passed QA.', '');
  for (const s of warns) {
    L.push(`#### ${s.id}${s.word ? ` (${s.word})` : ''}: \`${s.audio}\``, '',
      `- Text: ${s.text}`,
      `- Kept attempt ${s.qa.chosenAttempt} of ${s.qa.attempts}; similarity ${s.qa.sim} (char ${s.qa.charSim}, pinyin ${s.qa.pinyinSim ?? 'n/a'}); length ratio ${s.qa.lenRatio}`,
      `- Transcript: ${s.qa.transcript}`,
      `- Why it failed: ${s.qa.reasons.join('; ')}`, '',
      '| attempt | similarity | duration (s) | transcript | failure reasons |', '|---:|---:|---:|---|---|');
    for (const h of s.qa.history) {
      L.push(h.error ? `| ${h.attempt} | - | - | (error) | ${esc(h.error)} |`
        : `| ${h.attempt} | ${h.sim.toFixed(3)} | ${h.duration.toFixed(3)} | ${esc(h.transcript)} | ${esc(h.reasons.join('; '))} |`);
    }
    L.push('');
  }
  if (retried.length) {
    L.push('### Retried clips: attempts not kept', '', '| clip | attempt | similarity | duration (s) | why not kept | transcript |', '|---|---:|---:|---:|---|---|');
    for (const s of retried) for (const h of s.qa.history) if (h.attempt !== s.qa.chosenAttempt) {
      const why = h.error ?? (h.pass
        ? `passed only via pinyin (char ${h.charSim}); kept looking for a character-level pass`
        : h.reasons.join('; '));
      L.push(`| ${s.id} | ${h.attempt} | ${h.error ? '-' : h.sim.toFixed(3)} | ${h.error ? '-' : h.duration.toFixed(3)} | ${esc(why)} | ${esc((h.transcript ?? '').slice(0, 60))} |`);
    }
    L.push('');
  }
  return L.join('\n');
}

async function updateAudioDoc(section) {
  const f = P('docs/AUDIO.md');
  const BEGIN = '<!-- QA:BEGIN -->', END = '<!-- QA:END -->';
  let doc = existsSync(f) ? await fs.readFile(f, 'utf8') : `# Audio pipeline\n\n## QA results\n\n${BEGIN}\n${END}\n`;
  const a = doc.indexOf(BEGIN), b = doc.indexOf(END);
  doc = a >= 0 && b > a
    ? doc.slice(0, a + BEGIN.length) + '\n' + section + '\n' + doc.slice(b)
    : doc + `\n## QA results\n\n${BEGIN}\n${section}\n${END}\n`;
  await fs.writeFile(f, doc);
}

// ---------- main ----------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const narr = await readJson(P('script/narration.json'));
  await fs.mkdir(P('audio/cues'), { recursive: true });
  await fs.mkdir(P('audio/vocab'), { recursive: true });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ggz-tts-'));
  const log = (s) => console.log(s);
  const t0 = Date.now();

  const jobs = buildJobs(narr);
  if (opts.only) {
    const unknown = [...opts.only].filter((k) => !jobs.some((j) => j.keys.includes(k)));
    if (unknown.length) throw new Error(`--only: unknown id(s): ${unknown.join(', ')}`);
  }

  // Decide per job: regenerate or reuse.
  const plan = [];
  for (const job of jobs) {
    const sc = await cachedSidecar(job);
    const selected = opts.only ? job.keys.some((k) => opts.only.has(k)) : true;
    let action;
    if (opts.only) action = selected ? 'generate' : (sc ? 'reuse' : 'missing');
    else action = !opts.force && cacheValid(job, sc) ? 'reuse' : 'generate';
    if (action === 'reuse' && !cacheValid(job, sc) && opts.only) log(`  note: ${job.id} reused although stale or not QA-passed`);
    plan.push({ job, sc, action });
  }
  const missing = plan.filter((p) => p.action === 'missing');
  if (missing.length) throw new Error(`--only given but these clips have no audio yet: ${missing.map((p) => p.job.id).join(', ')}`);
  const todo = plan.filter((p) => p.action === 'generate');
  log(`TTS: ${todo.length} to generate, ${plan.length - todo.length} cached (concurrency ${opts.concurrency}, model ${TTS_MODEL}, QA ${STT_MODEL})`);

  const failures = [];
  let done = 0;
  await pool(todo, opts.concurrency, async (p) => {
    try {
      p.sc = await generate(p.job, tmp, log);
      log(`[${++done}/${todo.length}] ${p.job.id} ${p.sc.qa.pass ? 'ok' : 'WARN'} (${p.sc.duration.toFixed(2)}s, ${p.sc.qa.attempts} attempt${p.sc.qa.attempts > 1 ? 's' : ''})`);
    } catch (e) {
      failures.push(`${p.job.id}: ${redact(e.message)}`);
      log(`[${++done}/${todo.length}] ${p.job.id} FAILED: ${redact(e.message)}`);
    }
  });
  if (failures.length) {
    console.error(`\n${failures.length} clip(s) have no audio:\n  ${failures.join('\n  ')}\nRe-run to retry; nothing else was written.`);
    process.exitCode = 1;
    return;
  }
  // Re-measure every clip with ffprobe (also refreshes cached durations).
  for (const p of plan) p.duration = await probeDuration(P(p.job.rel));

  const cuePlans = plan.filter((p) => p.job.kind === 'cue');
  const vocabPlans = plan.filter((p) => p.job.kind === 'vocab');
  const durations = Object.fromEntries(cuePlans.map((p) => [p.job.id, p.duration]));
  const timeline = buildTimeline(narr, durations, vocabPlans.map((p) => p.job));
  await writeJson(P('script/timeline.json'), timeline);
  log(`timeline: ${timeline.cues.length} cues, ${timeline.scenes.length} scenes, total ${timeline.total}s -> script/timeline.json`);

  log('merging narration...');
  const merge = await mergeNarration(timeline, tmp, log);

  const withDur = (p) => ({ ...p.sc, duration: p.duration });
  await updateAudioDoc(qaMarkdown(cuePlans.map(withDur), vocabPlans.map(withDur), timeline, merge));
  await fs.rm(tmp, { recursive: true, force: true });

  const all = plan.map((p) => p.sc);
  const warns = all.filter((s) => !s.qa.pass);
  const retried = all.filter((s) => s.qa.attempts > 1);
  log(`\n=== Summary (${((Date.now() - t0) / 1000).toFixed(0)}s) ===`);
  log(`total ${timeline.total}s (${fmtTime(timeline.total)}); clips: ${all.length}; needed retries: ${retried.length} [${retried.map((s) => `${s.id}x${s.qa.attempts}`).join(' ')}]`);
  if (!warns.length) log('QA: all clips passed.');
  for (const s of warns) {
    log(`WARNING ${s.id}: QA failed after ${s.qa.attempts} attempts; kept attempt ${s.qa.chosenAttempt} (sim ${s.qa.sim})`);
    log(`   text:       ${s.text}`);
    log(`   transcript: ${s.qa.transcript}`);
    log(`   reasons:    ${s.qa.reasons.join('; ')}`);
  }
}

main().catch((e) => { console.error(redact(e.stack ?? e.message ?? e)); process.exit(1); });
