#!/usr/bin/env node
// Frame-by-frame video renderer: headless Chromium -> JPEG frames -> ffmpeg.
// See docs/RENDER.md for usage, performance numbers and troubleshooting.
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { USAGE, parseRenderArgs } from './lib/render-args.mjs';
import { isServing, startStaticServer } from './lib/render-server.mjs';
import { launchBrowser, openRenderPage, checkDeterminism, DETERMINISM_MAX_DELTA } from './lib/render-browser.mjs';
import { buildAudioMixArgs, buildEncodeArgs, mediaDuration, runFfmpeg, startEncoder, verifyOutput } from './lib/render-ffmpeg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fromRoot = (p) => path.resolve(ROOT, p);
const rel = (p) => (p.startsWith(ROOT + path.sep) ? path.relative(ROOT, p) : p);

const EXIT = { ok: 0, error: 1, duration: 2, substituted: 3, nondeterministic: 4, interrupted: 130 };

// ---------------------------------------------------------------- output helpers
const isTTY = process.stdout.isTTY;
let statusShown = false;
function log(msg = '') {
  if (statusShown && isTTY) process.stdout.write('\r\x1b[2K');
  statusShown = false;
  process.stdout.write(msg + '\n');
}
function status(msg) {
  if (isTTY) {
    process.stdout.write('\r\x1b[2K' + msg);
    statusShown = true;
  } else {
    process.stdout.write(msg + '\n');
  }
}
const warn = (msg) => log(`WARNING: ${msg}`);
function clock(s) {
  if (!Number.isFinite(s)) return '--:--';
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(ss).padStart(2, '0')}`;
}
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class TimeoutError extends Error {}
function withTimeout(promise, ms, what) {
  let timer;
  promise.catch(() => {}); // a late rejection after the timeout must not crash the process
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(`${what} took longer than ${ms / 1000}s`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- main
async function main() {
  let opts;
  try {
    opts = parseRenderArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return EXIT.error;
  }
  if (opts.help) {
    console.log(USAGE);
    return EXIT.ok;
  }

  const cleanups = [];
  let encoder = null;
  let aborting = false;
  let interrupted = false;
  const wakers = new Set(); // resolvers of anything waiting on loop progress
  const wakeAll = () => {
    for (const w of [...wakers]) w();
    wakers.clear();
  };
  const waitWake = () => new Promise((r) => wakers.add(r));

  let sigints = 0;
  const onSignal = (sig) => {
    sigints++;
    if (sigints === 1 && !encoder) {
      // Still setting up (e.g. waiting for player.ready): nothing to finalise.
      log(`\n${sig}: aborting`);
      Promise.race([Promise.all(cleanups.reverse().map((fn) => fn())), sleep(5000)]).finally(() => process.exit(EXIT.interrupted));
    } else if (sigints === 1) {
      log(`\n${sig}: stopping capture and finalising the partial video (press Ctrl-C again to force quit)...`);
      interrupted = true;
      aborting = true;
      wakeAll();
    } else {
      encoder?.kill();
      process.exit(EXIT.interrupted);
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    // ------------------------------------------------------------ page URL / server
    let url = new URL(opts.url);
    if (await isServing(url.href)) {
      log(`Page:      ${url.href} (already served)`);
    } else {
      if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error(`${url.href} is not reachable and is not a localhost URL I could serve myself`);
      }
      const srv = await startStaticServer(ROOT, Number(url.port) || 80);
      cleanups.push(() => srv.close());
      url.hostname = '127.0.0.1';
      url.port = String(srv.port);
      log(`Page:      ${url.href} (own static server over ${ROOT})`);
      if (!(await isServing(url.href))) throw new Error(`${url.pathname} is not found under ${ROOT}`);
    }

    // ------------------------------------------------------------ audio sources
    const narrationPath = fromRoot(opts.narration);
    const audio = { narration: null, tone: false, bgm: null, bgmVolume: opts.bgmVolume };
    if (existsSync(narrationPath)) audio.narration = narrationPath;
    else if (opts.testTone) audio.tone = true;
    else if (!opts.checkOnly) throw new Error(`narration not found: ${narrationPath} (pass --test-tone to render with a test tone)`);
    if (opts.bgm) {
      const bgmPath = fromRoot(opts.bgm);
      if (existsSync(bgmPath)) audio.bgm = bgmPath;
      else log(`BGM:       ${bgmPath} not found, rendering without BGM`);
    }

    // ------------------------------------------------------------ browser
    const browser = await launchBrowser();
    cleanups.push(() => withTimeout(browser.close(), 15000, 'browser.close').catch(() => {}));
    const pageErrors = new Map();
    const onPageError = (msg) => {
      const n = (pageErrors.get(msg) ?? 0) + 1;
      pageErrors.set(msg, n);
      if (n === 1 && pageErrors.size <= 10) log(`page: ${msg}`);
    };
    const pageOpts = { width: opts.width, height: opts.height, quality: opts.quality, capture: opts.capture, fps: opts.fps };
    log(`Browser:   Chromium ${browser.version()} (headless), viewport ${opts.width}x${opts.height}, capture=${opts.capture}`);

    const t0 = performance.now();
    const first = await openRenderPage(browser, url.href, pageOpts, onPageError);
    log(`Ready:     player.ready resolved in ${((performance.now() - t0) / 1000).toFixed(1)}s, player.duration = ${first.duration}`);

    // ------------------------------------------------------------ range
    if (!(first.duration > 0)) throw new Error(`player.duration is ${first.duration}; expected a positive number of seconds`);
    let end = opts.end ?? first.duration;
    if (end > first.duration + 1e-9) {
      warn(`--end ${end} is past player.duration ${first.duration}; clamping`);
      end = first.duration;
    }
    // Frames f in [fStart, fEnd) at t = f / fps: covers [start, end) completely.
    const fStart = Math.floor(opts.start * opts.fps + 1e-6);
    const fEnd = Math.ceil(end * opts.fps - 1e-6);
    const total = fEnd - fStart;
    if (total <= 0) throw new Error(`nothing to render: start ${opts.start}s >= end ${end}s`);
    const range = { start: fStart / opts.fps, duration: total / opts.fps };

    // ------------------------------------------------------------ cross-checks
    if (opts.timeline) {
      const tlPath = fromRoot(opts.timeline);
      if (!existsSync(tlPath)) {
        warn(`timeline ${tlPath} not found; skipping duration cross-check`);
      } else {
        const tl = JSON.parse(await readFile(tlPath, 'utf8'));
        if (Math.abs(Number(tl.total) - first.duration) > 1 / opts.fps) {
          warn(`timeline.json total (${tl.total}s) != player.duration (${first.duration}s)`);
        } else {
          log(`Timeline:  total ${tl.total}s matches player.duration`);
        }
        if (tl.fps && Number(tl.fps) !== opts.fps && !opts.preview) warn(`timeline.json fps is ${tl.fps}, rendering at ${opts.fps}`);
      }
    }
    if (audio.narration) {
      const nd = await mediaDuration(audio.narration);
      log(`Narration: ${rel(audio.narration)} (${nd?.toFixed(2) ?? '?'}s)`);
      if (nd != null && Math.abs(nd - first.duration) > 0.5) warn(`narration is ${nd.toFixed(2)}s but player.duration is ${first.duration}s`);
      if (nd != null && nd < range.start + range.duration - 0.05) warn(`narration ends before the video; the rest is padded with silence`);
    } else if (audio.tone) {
      log(`Narration: missing -> generated test tone (440 Hz, beep every second)`);
    }
    if (audio.bgm) log(`BGM:       ${rel(audio.bgm)} looped at volume ${audio.bgmVolume}`);

    // ------------------------------------------------------------ audio pre-mix (fails fast)
    const outPath = fromRoot(opts.out);
    const partialPath = outPath.replace(/(\.[^./]+)?$/, '.partial$1');
    const logPath = outPath.replace(/(\.[^./]+)?$/, '.ffmpeg.log');
    const audioWav = path.join(path.dirname(outPath), `.${path.basename(outPath)}.audio.wav`);
    if (!opts.checkOnly) {
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(logPath, '');
      cleanups.push(() => rm(audioWav, { force: true }));
      const ta = performance.now();
      await runFfmpeg(buildAudioMixArgs(audio, range, audioWav), logPath);
      const ad = await mediaDuration(audioWav);
      if (ad == null || Math.abs(ad - range.duration) > 0.05) {
        throw new Error(`audio pre-mix is ${ad}s, expected ${range.duration.toFixed(3)}s (see ${rel(logPath)})`);
      }
      log(`Audio:     pre-mixed ${ad.toFixed(3)}s (${audio.narration ? 'narration' : audio.tone ? 'test tone' : 'silence'}${audio.bgm ? ` + BGM x${audio.bgmVolume}` : ''}) in ${((performance.now() - ta) / 1000).toFixed(1)}s`);
    }

    // ------------------------------------------------------------ determinism check
    if (opts.check) {
      const q = (p) => fStart + Math.min(total - 1, Math.round(p * (total - 1)));
      const frames = [...new Set([q(0), q(0) + (total > 1 ? 1 : 0), q(0.25), q(0.5), q(0.75), q(1)])].sort((a, b) => a - b);
      log(`Check:     capturing ${frames.length} frames 3x as PNG (page A forward, page B reverse, page A interleaved)`);
      const { ok } = await checkDeterminism(browser, url.href, pageOpts, frames, log);
      if (!ok) {
        log('Check:     FAILED - seek(t) is not deterministic; see docs/RENDER.md#troubleshooting');
        await first.close();
        return EXIT.nondeterministic;
      }
      log(`Check:     passed (sample frames identical or within +-${DETERMINISM_MAX_DELTA}/255 raster rounding)`);
      if (opts.checkOnly) {
        await first.close();
        return EXIT.ok;
      }
    }

    // ------------------------------------------------------------ workers
    const workerCount = Math.min(opts.workers, total);
    const workers = [{ id: 0, page: first }];
    const extra = await Promise.all(
      Array.from({ length: workerCount - 1 }, (_, i) => openRenderPage(browser, url.href, pageOpts, onPageError)),
    );
    extra.forEach((page, i) => workers.push({ id: i + 1, page }));
    cleanups.push(() => Promise.all(workers.map((w) => w.page.close())));

    // ------------------------------------------------------------ encoder
    await rm(partialPath, { force: true });
    encoder = startEncoder(buildEncodeArgs(opts, audioWav, range, partialPath), logPath);
    const encoderRef = encoder;
    encoder.exited.then((code) => {
      if (!aborting && code !== 0) {
        aborting = true;
        wakeAll();
      }
    });
    log(`Frames:    ${fStart}..${fEnd - 1} (${total} frames, ${range.duration.toFixed(3)}s from t=${range.start.toFixed(3)}s) @ ${opts.fps} fps, ${workerCount} workers`);
    log(`Output:    ${rel(outPath)} ${opts.outWidth}x${opts.outHeight} x264 ${opts.preset} crf ${opts.crf}, JPEG q${opts.quality} (ffmpeg log: ${rel(logPath)})`);

    // ------------------------------------------------------------ capture loop
    const results = new Map(); // relative frame index -> Buffer | null (null = substitute previous)
    const maxAhead = workerCount * 4;
    let nextDispatch = 0;
    let nextWrite = 0;
    let fatal = null;
    let consecutiveFailures = 0;
    const substituted = [];
    const captureMs = [];
    let bytesIn = 0;
    const loopStart = performance.now();

    async function recycle(worker) {
      await withTimeout(worker.page.close(), 10000, 'closing page').catch(() => {});
      worker.page = await withTimeout(openRenderPage(browser, url.href, pageOpts, onPageError), 120000, 'reopening page');
    }

    async function captureFrame(worker, f) {
      const t = f / opts.fps;
      const s = performance.now();
      try {
        const buf = await withTimeout(worker.page.capture(t), opts.frameTimeoutMs, `frame ${f}`);
        captureMs.push(performance.now() - s);
        consecutiveFailures = 0;
        return buf;
      } catch (err) {
        if (aborting) return null;
        log(`[watchdog] worker ${worker.id}: frame ${f} (t=${t.toFixed(3)}s): ${err.message.split('\n')[0]} - reopening the page and retrying`);
        await recycle(worker);
        try {
          const buf = await withTimeout(worker.page.capture(t), opts.frameTimeoutMs * 2, `frame ${f} (retry)`);
          captureMs.push(performance.now() - s);
          consecutiveFailures = 0;
          return buf;
        } catch (err2) {
          if (++consecutiveFailures >= 10) throw new Error(`10 frames in a row failed; last: ${err2.message}`);
          log(`[watchdog] frame ${f} failed again (${err2.message.split('\n')[0]}); substituting the previous frame`);
          await recycle(worker); // the page may still be stuck; start the next frame on a fresh one
          return null;
        }
      }
    }

    async function workerLoop(worker) {
      while (!aborting) {
        while (nextDispatch - nextWrite >= maxAhead && !aborting) await waitWake();
        if (aborting || nextDispatch >= total) return;
        const i = nextDispatch++;
        const buf = await captureFrame(worker, fStart + i);
        results.set(i, buf);
        wakeAll();
      }
    }

    async function writerLoop() {
      let last = null;
      let windowStart = performance.now();
      let windowFrames = 0;
      let recentFps = 0;
      let lastPrint = performance.now();
      while (nextWrite < total && !aborting) {
        if (!results.has(nextWrite)) {
          await waitWake();
          continue;
        }
        let buf = results.get(nextWrite);
        results.delete(nextWrite);
        if (buf === null) {
          if (!last) throw new Error(`first frame ${fStart + nextWrite} could not be captured`);
          substituted.push(fStart + nextWrite);
          buf = last;
        }
        await encoderRef.write(buf);
        bytesIn += buf.length;
        last = buf;
        nextWrite++;
        windowFrames++;
        wakeAll();
        // TTY: one line rewritten every 30 frames. Pipes/logs: a new line every 10 s.
        if ((nextWrite % 30 === 0 && (isTTY || performance.now() - lastPrint > 10000)) || nextWrite === total) {
          const now = performance.now();
          lastPrint = now;
          const elapsed = (now - loopStart) / 1000;
          if (now - windowStart > 1500 || !recentFps) {
            recentFps = windowFrames / ((now - windowStart) / 1000);
            windowStart = now;
            windowFrames = 0;
          }
          const avg = nextWrite / elapsed;
          const eta = (total - nextWrite) / (recentFps || avg);
          status(
            `frame ${String(nextWrite).padStart(String(total).length)}/${total} ` +
              `${((nextWrite / total) * 100).toFixed(1).padStart(5)}%  ` +
              `${recentFps.toFixed(1)} fps (avg ${avg.toFixed(1)})  ` +
              `elapsed ${clock(elapsed)}  ETA ${clock(eta)}  ` +
              `${mb(bytesIn)} in${substituted.length ? `  substituted ${substituted.length}` : ''}`,
          );
        }
      }
    }

    const fail = (err) => {
      fatal ??= err;
      aborting = true;
      wakeAll();
    };
    await Promise.all([...workers.map((w) => workerLoop(w).catch(fail)), writerLoop().catch(fail)]);
    const loopSecs = (performance.now() - loopStart) / 1000;
    if (statusShown) log();

    // ------------------------------------------------------------ finish
    status('Encoding:  waiting for ffmpeg to finish...');
    const code = await encoder.finish();
    log(`Encoding:  ffmpeg exited with code ${code} ${((performance.now() - loopStart) / 1000 - loopSecs).toFixed(1)}s after the last frame`);
    if (code !== 0) {
      log(encoder.tail());
      throw new Error(`ffmpeg failed (code ${code}); full log: ${logPath}`);
    }
    if (fatal) throw fatal;

    const written = nextWrite;
    const sorted = [...captureMs].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? NaN;
    log(
      `Capture:   ${written} frames in ${clock(loopSecs)} = ${(written / loopSecs).toFixed(1)} fps overall ` +
        `(${workerCount} workers; per frame avg ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(0)} ms, ` +
        `p95 ${pct(0.95).toFixed(0)} ms, max ${pct(1).toFixed(0)} ms; ${mb(bytesIn / Math.max(1, written))} JPEG/frame avg)`,
    );
    const waits = workers.reduce((a, w) => ({ f: a.f + w.page.stats.fontWaits, i: a.i + w.page.stats.imageWaits }), { f: 0, i: 0 });
    if (waits.f || waits.i) {
      log(`Settle:    waited for web fonts on ${waits.f} and for images on ${waits.i} frame(s) (assets the page's ready did not preload)`);
    }
    if (pageErrors.size) {
      warn(`${[...pageErrors.values()].reduce((a, b) => a + b, 0)} page errors (${pageErrors.size} distinct) during render`);
    }

    const finalPath = interrupted ? partialPath : outPath;
    if (!interrupted) await rename(partialPath, outPath);
    const expected = written / opts.fps;
    const info = await verifyOutput(finalPath, expected);
    log(`\nffprobe ${rel(finalPath)}`);
    log(`  duration    ${info.videoDuration.toFixed(3)}s video / ${info.formatDuration.toFixed(3)}s container (expected ${expected.toFixed(3)}s)`);
    log(`  resolution  ${info.width}x${info.height}  ${info.videoCodec}`);
    log(`  fps         ${Number(info.fps.toFixed(3))}${info.frames ? `  (${info.frames} frames)` : ''}`);
    log(`  audio       ${info.audio.length ? info.audio.map((a) => `${a.codec} ${a.sampleRate} Hz ${a.channels}ch ${a.duration.toFixed(3)}s${a.bitrate ? ` ${Math.round(a.bitrate / 1000)} kb/s` : ''}`).join('; ') : 'NONE'}`);
    log(`  size        ${mb(info.size)} (${(await stat(finalPath)).size} bytes)`);

    if (interrupted) {
      log(`\nInterrupted: partial video (${written}/${total} frames) kept at ${rel(finalPath)}`);
      return EXIT.interrupted;
    }
    if (!info.ok) {
      log(`\nFAILED: video duration ${info.videoDuration.toFixed(3)}s differs from expected ${expected.toFixed(3)}s by ${info.diff.toFixed(3)}s (> 0.5s)`);
      return EXIT.duration;
    }
    if (info.audio.length === 0) {
      log('\nFAILED: output has no audio stream');
      return EXIT.error;
    }
    if (substituted.length) {
      log(`\nWARNING: ${substituted.length} frame(s) could not be captured and repeat the previous frame: ${substituted.slice(0, 20).join(', ')}${substituted.length > 20 ? ', ...' : ''}`);
      return EXIT.substituted;
    }
    log(`\nDone: ${rel(outPath)}`);
    return EXIT.ok;
  } catch (err) {
    if (sigints) return EXIT.interrupted; // errors caused by tearing down on Ctrl-C
    log(`\nERROR: ${process.env.DEBUG ? err.stack : err.message ?? err}`);
    return interrupted ? EXIT.interrupted : EXIT.error;
  } finally {
    aborting = true;
    wakeAll();
    if (encoder) {
      // Only reached with an encoder still running on error paths.
      await withTimeout(encoder.finish(), 30000, 'ffmpeg shutdown').catch(() => encoder.kill());
    }
    for (const fn of cleanups.reverse()) await fn();
  }
}

process.exitCode = await main();
// Playwright / http keep-alive handles can linger; exit explicitly.
await sleep(50);
process.exit(process.exitCode);
