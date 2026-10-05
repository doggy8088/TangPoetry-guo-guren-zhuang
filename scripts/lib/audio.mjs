// ffmpeg / ffprobe helpers for the audio pipeline.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

const BIN = process.env.FFMPEG_DIR ?? '/opt/homebrew/bin';
export const FFMPEG = process.env.FFMPEG ?? `${BIN}/ffmpeg`;
export const FFPROBE = process.env.FFPROBE ?? `${BIN}/ffprobe`;

export const CLIP_RATE = 24000; // Gemini TTS output; clips stay 24 kHz mono s16le.

export const TRIM_FILTER =
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse';

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [], err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', reject);
    p.on('close', (code) => {
      const stdout = Buffer.concat(out).toString(), stderr = Buffer.concat(err).toString();
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd.split('/').pop()} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

export async function probeDuration(file) {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`ffprobe: no duration for ${file}`);
  return d;
}

function lastJson(stderr) {
  const a = stderr.lastIndexOf('{'), b = stderr.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('loudnorm: no JSON in ffmpeg output');
  return JSON.parse(stderr.slice(a, b + 1));
}

/**
 * Trim leading/trailing silence, then two-pass loudnorm (measure, then apply
 * linearly) to I=-16 LUFS / TP=-1.5 / LRA=11. Output: 24 kHz mono s16le WAV.
 * Returns { duration, measured }.
 */
export async function processClip(inFile, outFile, { I = -16, TP = -1.5, LRA = 11 } = {}) {
  const { stderr } = await run(FFMPEG, [
    '-hide_banner', '-nostats', '-i', inFile,
    '-af', `${TRIM_FILTER},loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`,
    '-f', 'null', '-',
  ]);
  const m = lastJson(stderr);
  const finite = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']
    .every((k) => Number.isFinite(parseFloat(m[k])));
  const ln = finite
    ? `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
      `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;
  await run(FFMPEG, [
    '-hide_banner', '-nostats', '-y', '-i', inFile,
    '-af', `${TRIM_FILTER},${ln}`,
    '-ar', String(CLIP_RATE), '-ac', '1', '-c:a', 'pcm_s16le', '-map_metadata', '-1', outFile,
  ]);
  return { duration: await probeDuration(outFile), measured: { I: +m.input_i, TP: +m.input_tp } };
}

/**
 * Make a QA copy for transcription: optionally only the first `seconds`, with
 * `pad` seconds of silence added on both sides. The transcriber drops syllables
 * at the very edges of a tightly trimmed clip (e.g. 我們下次見 -> 我們見), and
 * recognizes the same audio correctly once it is padded.
 */
export async function qaCopy(inFile, outFile, { seconds = null, pad = 0.5 } = {}) {
  const ms = Math.round(pad * 1000);
  await run(FFMPEG, ['-hide_banner', '-nostats', '-y', ...(seconds ? ['-t', String(seconds)] : []), '-i', inFile,
    '-af', `adelay=${ms}:all=1,apad=pad_dur=${pad}`, '-c:a', 'pcm_s16le', outFile]);
}

/** Read a PCM s16le WAV (any chunk layout) -> { rate, channels, samples: Int16Array }. */
export async function readWav(file) {
  const buf = await fs.readFile(file);
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV`);
  let off = 12, fmt = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
      if (size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      const n = Math.floor(size / 2);
      const samples = new Int16Array(n);
      for (let i = 0; i < n; i++) samples[i] = buf.readInt16LE(body + 2 * i);
      return { rate: fmt.rate, channels: fmt.channels, samples };
    }
    off = body + size + (size & 1);
  }
  throw new Error(`${file}: no data chunk`);
}

/**
 * Place each clip at its start time (sample-exact via adelay "S" units) on a
 * silent bed exactly `total` seconds long; write a 24 kHz mono s16le master WAV.
 */
export async function mixAtOffsets(clips, total, outWav, rate = CLIP_RATE) {
  const totalSamples = Math.round(total * rate);
  const args = ['-hide_banner', '-nostats', '-y'];
  // Input 0: silent bed that defines the full length.
  args.push('-f', 'lavfi', '-i', `anullsrc=r=${rate}:cl=mono`);
  for (const c of clips) args.push('-i', c.file);
  const parts = [`[0:a]atrim=end_sample=${totalSamples}[bed]`];
  const labels = ['[bed]'];
  clips.forEach((c, i) => {
    const delay = Math.round(c.start * rate);
    parts.push(`[${i + 1}:a]aresample=${rate},aformat=channel_layouts=mono,adelay=delays=${delay}S:all=1[c${i}]`);
    labels.push(`[c${i}]`);
  });
  parts.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first:dropout_transition=0,` +
    `atrim=end_sample=${totalSamples}[out]`);
  args.push('-filter_complex', parts.join(';'), '-map', '[out]', '-ar', String(rate), '-ac', '1', '-c:a', 'pcm_s16le', outWav);
  await run(FFMPEG, args);
}

export async function encodeM4a(inFile, outFile, { bitrate = '128k', rate = 48000, channels = 2 } = {}) {
  await run(FFMPEG, ['-hide_banner', '-nostats', '-y', '-i', inFile, '-ar', String(rate), '-ac', String(channels),
    '-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart', outFile]);
}

export async function encodeMp3(inFile, outFile, { bitrate = '192k', rate = 48000, channels = 2 } = {}) {
  await run(FFMPEG, ['-hide_banner', '-nostats', '-y', '-i', inFile, '-ar', String(rate), '-ac', String(channels),
    '-c:a', 'libmp3lame', '-b:a', bitrate, outFile]);
}
