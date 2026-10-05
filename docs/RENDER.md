# Video rendering (`scripts/render.mjs`)

Renders `index.html?render=1` frame by frame in headless Chromium and encodes
`out/guo-guren-zhuang.mp4` (1080×1920, 30 fps, H.264 + AAC) with the narration
and looped BGM mixed in. The web page and the video come from the same code, so
they always match.

```
          ┌──────────── 4 headless pages (own browser contexts) ────────────┐
frame f → │ window.__renderSeek(f/fps) → CDP Page.captureScreenshot (JPEG)  │
          └──────────────────────────┬──────────────────────────────────────┘
                                     │ reorder buffer, frames in order
audio/narration.m4a ┐                ▼
audio/bgm.m4a (loop)┴─ pass 1: mix → .wav ─→ pass 2: ffmpeg image2pipe → libx264 slow crf 18
                                                + AAC 160k → out/*.partial.mp4 → rename → ffprobe check
```

## Quick start

```sh
npm run render                       # full video  → out/guo-guren-zhuang.mp4
npm run render -- --preview          # 540×960, 15 fps, crf 28 → out/guo-guren-zhuang.preview.mp4
npm run render -- --start 95 --end 130 --preview   # just one scene, quickly
npm run render -- --check-only       # is seek(t) deterministic? (no video)
npm run render:test                  # renders scripts/render-stub.html → out/stub-test.mp4
```

You do not need to start a server. If nothing answers at the `--url`, the
renderer starts a tiny static server over the project directory on that port
(or on a free port if the port is busy with something else) and stops it at the
end. If a dev server is already serving the URL, it is used as-is.

## Options

| Option | Default | Notes |
|---|---|---|
| `--url <url>` | `http://localhost:5173/index.html?render=1` | page implementing the contract below |
| `--fps <n>` | 30 (preview 15) | |
| `--start <sec>` | 0 | first frame = `floor(start·fps)` |
| `--end <sec>` | `player.duration` | exclusive; frames cover `[start, end)`; clamped to the duration |
| `--out <path>` | `out/guo-guren-zhuang.mp4` (preview: `….preview.mp4`) | relative paths are relative to the project root |
| `--quality <1-100>` | 92 | JPEG quality of the captured frames |
| `--crf <n>` / `--preset <name>` | 18 / slow (preview: 28 / veryfast) | x264 |
| `--preview` | off | captures at 1080×1920, scales to 540×960 in ffmpeg (lanczos) |
| `--narration <path>` | `audio/narration.m4a` | required unless `--test-tone` |
| `--bgm <path>` / `--no-bgm` | `audio/bgm.m4a` | looped for the whole range; skipped with a note if missing |
| `--bgm-volume <x>` | 0.25 | |
| `--test-tone` | off | if the narration is missing, use a 440 Hz tone with a 1760 Hz beep on every whole second (good for A/V sync checks) |
| `--timeline <path\|none>` | `script/timeline.json` | warns if its `total` ≠ `player.duration` or its `fps` ≠ `--fps` |
| `--workers <n>` | 4 | parallel pages; see performance |
| `--capture <cdp\|playwright>` | cdp | `playwright` = `page.screenshot()`, ~10 % slower |
| `--frame-timeout <sec>` | 15 | watchdog, see below |
| `--check` | off | determinism check before rendering; abort if it fails |
| `--check-only` | off | only the determinism check |

Exit codes: `0` ok · `1` error · `2` output duration off by > 0.5 s ·
`3` video written but some frames had to be substituted · `4` determinism check
failed · `130` interrupted (Ctrl-C).

## What the page must provide (render mode)

`window.player = { ready: Promise<void>, duration: number, seek(t): void }`,
stage 1080×1920 at (0,0) — see `docs/DESIGN.md` → 渲染模式. The renderer:

1. opens the URL in a 1080×1920 viewport (deviceScaleFactor 1), waits for
   `window.player` to exist (up to 180 s), awaits `player.ready`, reads
   `player.duration`;
2. for every frame calls `window.player.seek(f / fps)`, then forces a style /
   layout pass and, **if that made the page start loading a web font or an
   `<img>`, waits for it** before taking the screenshot. Google Fonts serves CJK
   fonts as ~100 `unicode-range` slices that are only downloaded when a
   character is first displayed, so a subtitle shown for the first time would
   otherwise be captured in the fallback font (reproduced and fixed during
   development). The summary prints `Settle: waited for web fonts on N frames`
   when this happened; it is harmless, but it means `ready` did not preload
   everything (see troubleshooting).

Rules for `seek(t)` so frames are deterministic:

- All visual state must be a pure function of `t` — GSAP timeline `pause(t)` /
  `time(t)` is fine. No CSS `animation`/`transition` (they run on the wall
  clock), no `Date.now()`/`performance.now()`/`requestAnimationFrame`-driven
  state, no `Math.random()` at seek time (seeded random at load time is fine).
- Seeking backwards or jumping must give the same result as playing forward
  (the 4 worker pages take frames round-robin, so nearly every seek is a jump).

## Output details

- **Video**: JPEG frames (full-range BT.601, as Chromium encodes them) are
  converted to limited-range **BT.709** `yuv420p` with
  `accurate_rnd+full_chroma_int` and tagged `bt709/tv`, which is what phones,
  browsers and YouTube assume for HD H.264. (Without those flags swscale
  silently skipped the matrix conversion; reds/blues were off by ~5/255.)
  Measured round trip Chromium PNG → mp4 → RGB: flat colours within 2–3/255,
  PSNR 37.6 dB on the noisy test page.
- **Audio** (pass 1, before capturing — fails fast, takes < 1 s for 8 min):
  narration and BGM are trimmed to exactly `[start, start+duration)`
  (`atrim`), BGM is looped with `-stream_loop -1`, scaled by `--bgm-volume`, and
  `amix=inputs=2:duration=first:normalize=0` mixes them. Narration is padded
  with silence to the full length so a short narration can never shorten the
  video via `-shortest`. Result is a float WAV next to the output
  (`out/.<name>.audio.wav`, deleted afterwards). Audio sources are read only
  here, so regenerating them while frames are being captured does not corrupt
  the render (it did before this design: a BGM rewrite mid-render broke the
  AAC decoder).
- **Mux** (pass 2): `libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30`,
  AAC 160 kb/s 48 kHz, `-t <duration> -shortest -movflags +faststart`. Written
  to `*.partial.mp4` and renamed when complete, so a failed or interrupted run
  never replaces a good video.
- **Verification**: ffprobe prints duration, resolution, fps, frame count,
  audio streams and size; the run fails (exit 2) if the video duration differs
  from `frames / fps` by more than 0.5 s, or if there is no audio stream.
- **Logs**: the exact ffmpeg command lines and their stderr are in
  `out/<name>.ffmpeg.log`.

Range semantics: frames `f = floor(start·fps) … ceil(end·fps)−1`, so the full
render of `player.duration = 487.793` is 14 634 frames = 487.800 s and the
narration is trimmed/padded to the same 487.800 s.

## Robustness

- **Watchdog**: if a frame takes longer than `--frame-timeout` (15 s), it logs
  `[watchdog] …`, closes that page, opens a fresh one and retries the frame
  (30 s). If the retry also fails, the previous frame is repeated (keeps A/V
  sync), the page is recycled again, rendering continues, and the run ends with
  exit code 3 listing the substituted frames. 10 consecutive failures abort.
  Tested with a page that hangs for 60 s in `seek()` at one frame.
- **Ctrl-C**: the first one stops capturing, closes ffmpeg's stdin and
  finalises a playable `*.partial.mp4` containing everything captured so far
  (exit 130). A second Ctrl-C kills everything immediately. ffmpeg and
  Chromium run in their own process groups, so the terminal's SIGINT does not
  kill them mid-file.
- **Page errors**: uncaught exceptions and `console.error` from the page are
  printed (first 10 distinct) and counted in the summary.
- **Memory**: workers can be at most `4 × workers` frames ahead of the encoder.
  Chromium stayed at ~1.6 GB RSS total (4 pages) for a whole 14 634-frame run.

## Performance

Measured on Apple M5 Max (18 cores), Chromium 153 headless shell (Playwright
1.63), ffmpeg 9.0.2, 1080×1920 capture. Other jobs (TTS, a VM) were running at
the same time, so treat these as conservative; numbers moved ±20 % between runs.
"light" = `scripts/render-stub.html`, "heavy" = `…?heavy=1` (SVG paper texture
`feTurbulence` + displacement filter + gradients + 200 animated shapes, closer
to the real art).

Raw capture loop, one page (seek + screenshot only):

| page | `page.screenshot` JPEG | CDP `Page.captureScreenshot` JPEG | CDP PNG |
|---|---|---|---|
| light | 60 fps (capped by the 60 Hz frame clock) | 60 fps | 47 fps |
| heavy | 29 fps | 28–29.5 fps | 15 fps |

The two JPEG methods are within noise on a single page; with workers CDP was
~10 % faster (55.4 vs 50.4 fps, heavy, 4 workers), so it is the default.
Chromium flags `--disable-gpu`, `--disable-frame-rate-limit`,
`--run-all-compositor-stages-before-draw` made no significant difference.

Whole pipeline (`render.mjs`, 600 frames, x264 slow crf 18, real encode):

| `--workers` | 1 | 2 | 4 (default) | 6 | 8 |
|---|---|---|---|---|---|
| heavy stub | 22.6 fps | 35.7 | 55.4 | 63.2 | 66.0 |
| light stub | 49.5 fps | 60.2 | 91.1 | 89.1 | 94.5 |

- `npm run render:test` (360 heavy frames + determinism check): 45–70 fps
  capture, ~10 s total.
- Full-length dry run (heavy stub, 487.8 s = 14 634 frames, real narration +
  BGM, 4 workers, machine load average 45–67): **6 min 31 s capture
  (37.4 fps avg)** + 5 s encoder tail, 193.6 MB output, duration exact, full
  decode clean. On an idle machine expect ~55 fps → ~4.5 min.
- x264 `slow` at 1080×1920 encodes ~250 fps and the colour conversion ~400 fps
  — never the bottleneck; capture (Chromium raster + JPEG encode) is.
- `--preview` captures at full size, so it is only slightly faster per frame,
  but it renders half the frames (15 fps).

If the real page is slower than the heavy stub, try `--workers 6` (gains flatten
after ~6 on this machine) and look at the per-frame `avg / p95 / max` ms in the
summary. Very large blurred or filtered layers (`filter: blur()`,
`feTurbulence` over the full stage) are what costs the most raster time.

## Determinism check

`--check` / `--check-only` captures 6 sample frames (first, second, 25 %, 50 %,
75 %, last) as lossless PNG three times — page A forward, a second page B in
reverse order with a jump elsewhere before every capture, page A again
interleaved — and compares them. Output looks like:

```
  frame      0  t=   0.000  8fc93a8138f5 8fc93a8138f5 8fc93a8138f5  identical
  frame      1  t=   0.033  46216be31702 508188b37d60 508188b37d60  OK: 1884 px differ, max delta 1
```

Chromium only re-rasterises the damaged part of the page, so the same DOM
reached from a different previous frame can differ by ±1 in a few pixels
(seen on the heavy stub at frame 1). That is invisible and far below the
JPEG/x264 error, so differences up to 2/255 pass. A real seek bug shows up as
`MISMATCH: … max delta 200+` (verified with `render-stub.html?nondet=1`).

## The stub page

`scripts/render-stub.html` implements the same contract (duration 12 s): a
moving ball, a rotating square, a big `t` readout and frame number, subtitle
text, a red dot that is bright for the first 100 ms of every second (lines up
with the test-tone beeps), and a progress bar. Query parameters:
`heavy=1` (SVG art layer), `duration=<sec>`, and two test hooks —
`hang=<sec>` (seek busy-waits 60 s at that time → watchdog) and `nondet=1`
(wall-clock text → must fail `--check`).

`npm run render:test` renders `render-stub.html?heavy=1` with `--check`. When
`audio/narration.m4a` exists it uses its first 12 s (and prints a harmless
`narration is …s but player.duration is 12s` warning); otherwise the test tone.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `window.player was not exposed … within 180s` | Page failed to boot. Look at the `page: pageerror …` lines printed above it; open the same URL in a browser. |
| `… is not found under <project>` | No `index.html` yet, or wrong `--url` path. |
| `narration not found` | Generate `audio/narration.m4a` first, or pass `--test-tone` for a silent/test render. |
| Determinism check fails | Something in the page depends on wall-clock time or on the previous frame: CSS animations/transitions, `Date.now()`, `requestAnimationFrame` loops, `Math.random()` in `seek`, GSAP tweens created lazily during playback (`onComplete` spawning new tweens), or `.from()` tweens whose start values are captured on first render (use `immediateRender`/`fromTo`). |
| Subtitle glyphs in a fallback font on some frames, or `Settle: waited for web fonts` | Preload all text before resolving `ready`, e.g. `await document.fonts.load('48px "Noto Sans TC"', allSubtitleText)` for every family/weight, then `await document.fonts.ready`. The renderer already waits per frame, so the video is correct either way; preloading just makes it faster. |
| Images missing in a frame | Preload/`decode()` images before resolving `ready`; CSS `background-image`s are not covered by the renderer's per-frame wait. |
| `[watchdog] … took longer than 15s` | A `seek()` that blocks (huge DOM rebuild, sync XHR, infinite loop) or a crashed page. The frame is retried on a fresh page; if it repeats, fix the page. `--frame-timeout 60` if frames are legitimately slow. |
| Exit code 3 | Some frames could not be captured and repeat the previous frame — re-render after fixing the page; the list of frame numbers is printed. |
| Exit code 2 / duration mismatch | ffmpeg stopped early: check `out/<name>.ffmpeg.log`. |
| `WARNING: timeline.json total (…) != player.duration (…)` | The page and the TTS timeline disagree; the video length follows `player.duration` (or `--end`). Regenerate one of them. |
| `WARNING: narration is …s but player.duration is …s` | Narration and page disagree by > 0.5 s; audio is trimmed/padded to the video, so sync at the end may be off. |
| Rendering through a Vite / live-reload dev server | Don't edit files during a render (HMR reloads would change pages mid-run). To force the built-in static server, use a free port: `--url http://localhost:5199/index.html?render=1`. |
| Colours look shifted in a player | Make sure the player honours BT.709 tags (all modern ones do). Compare with `ffprobe` → `color_space=bt709, color_range=tv`. |
| Slow capture | Increase `--workers` (up to ~6), close other heavy apps, check per-frame ms in the summary; use `--preview` for iteration. |
| Interrupted run | The partial video is in `out/<name>.partial.mp4` and playable. |
