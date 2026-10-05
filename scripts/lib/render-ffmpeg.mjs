// ffmpeg / ffprobe side of the renderer.
import { spawn, execFile } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { once } from 'node:events';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

function findTool(name) {
  for (const p of [process.env[`${name.toUpperCase()}_PATH`], `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`]) {
    if (p && existsSync(p)) return p;
  }
  return name; // rely on PATH
}
export const FFMPEG = findTool('ffmpeg');
export const FFPROBE = findTool('ffprobe');

export async function ffprobeJson(file) {
  const { stdout } = await execFileP(FFPROBE, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]);
  return JSON.parse(stdout);
}

/** Duration in seconds of a media file, or null if it cannot be probed. */
export async function mediaDuration(file) {
  try {
    const j = await ffprobeJson(file);
    return Number(j.format?.duration) || null;
  } catch {
    return null;
  }
}

/** Decode an encoded image (PNG/JPEG) Buffer to raw RGB24 pixels. */
export function decodeToRgb(buf) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg decode failed: ${err}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(buf);
  });
}

const sec = (x) => x.toFixed(6);

/**
 * Pass 1 (seconds, before any frame is captured): mix narration (or a test tone)
 * and looped BGM for exactly `range` into a PCM WAV. Doing this up front means
 * audio problems fail fast instead of after a long capture, and the source files
 * are read once (so they can be regenerated while frames are being captured).
 * audio = { narration: path|null, tone: bool, bgm: path|null, bgmVolume }
 * range = { start, duration } in seconds (frame-aligned).
 */
export function buildAudioMixArgs(audio, range, out) {
  const args = ['-hide_banner', '-nostats', '-loglevel', 'warning', '-y'];
  // 0: narration, or a generated test tone (440 Hz with a 1760 Hz beep on every whole second).
  if (audio.narration) args.push('-i', audio.narration);
  else if (audio.tone) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:beep_factor=4:sample_rate=48000');
  else args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  // 1: BGM, looped forever (trimmed by the filter graph).
  if (audio.bgm) args.push('-stream_loop', '-1', '-i', audio.bgm);

  const { start, duration } = range;
  const fmt = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
  const trim = `atrim=start=${sec(start)}:duration=${sec(duration)},asetpts=PTS-STARTPTS`;
  // Narration is padded with silence to the full range so a short track can never
  // shorten the video through -shortest.
  const narr = `[0:a]${fmt},${trim},apad=whole_dur=${sec(duration)}`;
  const graph = audio.bgm
    ? [
        `${narr}[nar]`,
        `[1:a]${fmt},${trim},volume=${audio.bgmVolume}[bgm]`,
        '[nar][bgm]amix=inputs=2:duration=first:normalize=0[a]',
      ]
    : [`${narr}[a]`];
  args.push('-filter_complex', graph.join(';'), '-map', '[a]', '-t', sec(duration), '-c:a', 'pcm_f32le', out);
  return args;
}

/** Run a short ffmpeg job to completion; appends its stderr to `logFile`. */
export async function runFfmpeg(args, logFile) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(logFile, `$ ${FFMPEG} ${quoteArgs(args)}\n`);
  try {
    const { stderr } = await execFileP(FFMPEG, args, { maxBuffer: 64 << 20 });
    await appendFile(logFile, stderr + '\n');
  } catch (err) {
    await appendFile(logFile, `${err.stderr ?? err.message}\n`);
    throw new Error(`ffmpeg failed: ${(err.stderr ?? err.message).trim().split('\n').slice(-5).join('\n')}`);
  }
}

const quoteArgs = (args) => args.map((a) => (/[\s;\[\]'&|]/.test(a) ? `'${a}'` : a)).join(' ');

/**
 * Pass 2: JPEG frames on stdin + the pre-mixed WAV -> H.264/AAC mp4.
 */
export function buildEncodeArgs({ fps, crf, preset, outWidth, outHeight }, audioWav, range, out) {
  const args = ['-hide_banner', '-nostats', '-loglevel', 'info', '-y'];
  // 0: frames from stdin (JPEG from Chromium: full-range BT.601 YCbCr).
  args.push('-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-thread_queue_size', '1024', '-i', 'pipe:0');
  // 1: the audio mixed by pass 1.
  args.push('-i', audioWav);
  // Convert JPEG's full-range BT.601 YCbCr to the limited-range BT.709 that players
  // assume for HD H.264, and tag the stream accordingly. accurate_rnd+full_chroma_int
  // matter: without them swscale takes an unscaled yuvj420p->yuv420p fast path that
  // silently ignores the matrix change (measured: reds/blues off by ~5/255).
  const scale = [
    `scale=${outWidth}:${outHeight}`,
    'in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709',
    `flags=${outWidth === 1080 ? 'bicubic' : 'lanczos'}+accurate_rnd+full_chroma_int`,
  ].join(':');
  args.push('-filter_complex', `[0:v]${scale},format=yuv420p[v]`, '-map', '[v]', '-map', '1:a');
  args.push(
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-t', sec(range.duration), '-shortest', '-movflags', '+faststart',
    out,
  );
  return args;
}

/**
 * Spawn ffmpeg reading frames from stdin. Returns
 * { write(buf): Promise, finish(): Promise<code>, kill(), exited: Promise<code>, tail() }.
 */
export function startEncoder(args, logFile) {
  // detached: a terminal Ctrl-C must not reach ffmpeg; render.mjs closes stdin
  // itself so the mp4 is finalised properly.
  const proc = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'], detached: true });
  const log = createWriteStream(logFile, { flags: 'a' });
  log.write(`\n$ ${FFMPEG} ${quoteArgs(args)}\n\n`);
  let tailBuf = '';
  proc.stderr.on('data', (d) => {
    log.write(d);
    tailBuf = (tailBuf + d.toString()).slice(-4000);
  });
  let stdinError = null;
  proc.stdin.on('error', (err) => {
    stdinError = err;
  });
  const exited = new Promise((resolve) => {
    proc.on('exit', (code, signal) => {
      log.end();
      resolve(code ?? (signal ? 128 : 1));
    });
    proc.on('error', (err) => {
      tailBuf += `\nspawn error: ${err.message}`;
      log.end();
      resolve(127);
    });
  });
  let done = false;
  exited.then(() => {
    done = true;
  });

  return {
    proc,
    exited,
    tail: () => tailBuf.trim(),
    async write(buf) {
      if (done || stdinError) throw new Error(`ffmpeg is no longer accepting frames${stdinError ? ` (${stdinError.code})` : ''}`);
      if (!proc.stdin.write(buf)) {
        await Promise.race([once(proc.stdin, 'drain'), exited]);
      }
    },
    async finish() {
      if (!proc.stdin.destroyed && !proc.stdin.writableEnded) proc.stdin.end();
      return exited;
    },
    kill() {
      try {
        proc.kill('SIGKILL');
      } catch {}
    },
  };
}

/** Summarise and validate the rendered file. Throws if duration is off by > tolerance. */
export async function verifyOutput(file, expectedDuration, tolerance = 0.5) {
  const j = await ffprobeJson(file);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const audio = j.streams.filter((s) => s.codec_type === 'audio');
  if (!v) throw new Error(`${file}: no video stream`);
  const [n, d] = (v.avg_frame_rate || v.r_frame_rate).split('/').map(Number);
  const vDur = Number(v.duration ?? j.format.duration);
  const info = {
    container: j.format.format_name,
    formatDuration: Number(j.format.duration),
    videoDuration: vDur,
    width: v.width,
    height: v.height,
    fps: d ? n / d : n,
    frames: Number(v.nb_frames) || null,
    videoCodec: `${v.codec_name} ${v.profile ?? ''} ${v.pix_fmt} ${v.color_range ?? ''}/${v.color_space ?? ''}`.trim(),
    audio: audio.map((a) => ({
      codec: a.codec_name,
      sampleRate: Number(a.sample_rate),
      channels: a.channels,
      duration: Number(a.duration),
      bitrate: Number(a.bit_rate) || null,
    })),
    size: Number(j.format.size),
  };
  const diff = Math.abs(vDur - expectedDuration);
  info.ok = diff <= tolerance;
  info.diff = diff;
  return info;
}
