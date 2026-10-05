// CLI parsing for scripts/render.mjs.
import { parseArgs } from 'node:util';

export const USAGE = `Usage: node scripts/render.mjs [options]

Renders a page that exposes window.player = { ready, duration, seek(t) } frame by
frame with headless Chromium and encodes it (plus narration/BGM) with ffmpeg.

Input / range
  --url <url>           page to render   [http://localhost:5173/index.html?render=1]
                        A static server over the project dir is started if the URL
                        is not already being served.
  --fps <n>             frames per second               [30, preview: 15]
  --start <sec>         first frame time                 [0]
  --end <sec>           end time (exclusive)             [player.duration]
  --timeline <path|none> cross-check duration/fps against this JSON
                                                         [script/timeline.json]
Output
  --out <path>          output file   [out/guo-guren-zhuang.mp4,
                                       preview: out/guo-guren-zhuang.preview.mp4]
  --quality <1-100>     JPEG quality of captured frames  [92]
  --crf <n>             x264 CRF                         [18, preview: 28]
  --preset <name>       x264 preset                      [slow, preview: veryfast]
  --preview             540x960 output, 15 fps, crf 28 (quick checks; still
                        captures at 1080x1920 and scales in ffmpeg)
Audio
  --narration <path>    narration track                  [audio/narration.m4a]
  --bgm <path>          looped background music          [audio/bgm.m4a]
  --bgm-volume <x>      BGM gain                         [0.25]
  --no-bgm              do not mix BGM even if present
  --test-tone           if the narration file is missing, use a generated
                        440 Hz tone with a beep every second instead of failing
Performance / robustness
  --workers <n>         parallel browser pages capturing frames   [4]
  --capture <cdp|playwright>  screenshot method                    [cdp]
  --frame-timeout <sec> watchdog per frame before retrying on a fresh page [15]
Checks
  --check               before rendering, capture sample frames twice (different
                        pages, different seek orders, lossless PNG) and abort if
                        their hashes differ
  --check-only          run the determinism check and exit (no video)
  -h, --help            show this help
`;

function num(name, value, { min = -Infinity, max = Infinity, int = false } = {}) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    throw new Error(`--${name} must be ${int ? 'an integer' : 'a number'} in [${min}, ${max}], got "${value}"`);
  }
  return n;
}

export function parseRenderArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      url: { type: 'string' },
      fps: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      timeline: { type: 'string' },
      out: { type: 'string' },
      quality: { type: 'string' },
      crf: { type: 'string' },
      preset: { type: 'string' },
      preview: { type: 'boolean', default: false },
      narration: { type: 'string' },
      bgm: { type: 'string' },
      'bgm-volume': { type: 'string' },
      'no-bgm': { type: 'boolean', default: false },
      'test-tone': { type: 'boolean', default: false },
      workers: { type: 'string' },
      capture: { type: 'string' },
      'frame-timeout': { type: 'string' },
      check: { type: 'boolean', default: false },
      'check-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const preview = values.preview;
  const capture = values.capture ?? 'cdp';
  if (!['cdp', 'playwright'].includes(capture)) throw new Error(`--capture must be cdp or playwright, got "${capture}"`);
  const timeline = values.timeline ?? 'script/timeline.json';

  return {
    help: values.help,
    url: values.url ?? 'http://localhost:5173/index.html?render=1',
    fps: num('fps', values.fps, { min: 1, max: 120 }) ?? (preview ? 15 : 30),
    start: num('start', values.start, { min: 0 }) ?? 0,
    end: num('end', values.end, { min: 0 }),
    timeline: timeline === 'none' ? null : timeline,
    out: values.out ?? (preview ? 'out/guo-guren-zhuang.preview.mp4' : 'out/guo-guren-zhuang.mp4'),
    quality: num('quality', values.quality, { min: 1, max: 100, int: true }) ?? 92,
    crf: num('crf', values.crf, { min: 0, max: 51 }) ?? (preview ? 28 : 18),
    preset: values.preset ?? (preview ? 'veryfast' : 'slow'),
    preview,
    width: 1080,
    height: 1920,
    outWidth: preview ? 540 : 1080,
    outHeight: preview ? 960 : 1920,
    narration: values.narration ?? 'audio/narration.m4a',
    bgm: values['no-bgm'] ? null : values.bgm ?? 'audio/bgm.m4a',
    bgmVolume: num('bgm-volume', values['bgm-volume'], { min: 0, max: 4 }) ?? 0.25,
    testTone: values['test-tone'],
    workers: num('workers', values.workers, { min: 1, max: 32, int: true }) ?? 4,
    capture,
    frameTimeoutMs: (num('frame-timeout', values['frame-timeout'], { min: 1 }) ?? 15) * 1000,
    check: values.check || values['check-only'],
    checkOnly: values['check-only'],
  };
}
