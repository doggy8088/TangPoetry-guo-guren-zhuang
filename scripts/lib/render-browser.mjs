// Headless Chromium side of the renderer: launching, opening render pages,
// seek + capture, and the determinism check.
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { decodeToRgb } from './render-ffmpeg.mjs';

export const CHROME_ARGS = [
  '--disable-partial-raster', // always repaint whole tiles so a frame never depends on the previous one
  '--font-render-hinting=none', // identical glyph rasterisation regardless of host settings
  '--force-color-profile=srgb', // screenshots in sRGB, not the Mac display profile
  '--disable-gpu', // software raster: slower by ~2 %, but stable across runs
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--hide-scrollbars',
  '--mute-audio',
];

const PAGE_TIMEOUT_MS = 180_000;

export async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: CHROME_ARGS,
    // render.mjs owns signal handling (it must finish the mp4 cleanly on Ctrl-C).
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });
}

/**
 * Runs in the page. window.__renderSeek(t) = player.seek(t), then makes sure the
 * frame about to be captured is complete: it forces style/layout so any web-font
 * subset (e.g. a CJK unicode-range slice first used by this frame's subtitle) or
 * <img> needed by the new DOM starts loading now, and waits for it. Returns a
 * bitmask: 1 = waited for fonts, 2 = waited for images. Costs ~nothing when
 * everything is already loaded (the normal case for a page whose `ready` preloads).
 */
function installSeekHelper() {
  window.__renderSeek = (t) => {
    window.player.seek(t);
    void document.documentElement.offsetHeight;
    let waited = 0;
    const waits = [];
    if (document.fonts && document.fonts.status === 'loading') {
      waited |= 1;
      waits.push(document.fonts.ready);
    }
    for (const img of document.images) {
      if (!img.complete) {
        waited |= 2;
        waits.push(img.decode().catch(() => {}));
      }
    }
    return waits.length ? Promise.all(waits).then(() => waited) : waited;
  };
}

/**
 * One isolated page (own browser context) ready to seek + capture.
 * `onPageError(msg)` receives uncaught page errors / console.error text.
 */
export async function openRenderPage(browser, url, opts, onPageError = () => {}) {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(PAGE_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
  const page = await context.newPage();
  page.on('pageerror', (err) => onPageError(`pageerror: ${err.message}`));
  page.on('console', (m) => m.type() === 'error' && onPageError(`console.error: ${m.text()}`));
  page.on('crash', () => onPageError('page crashed'));
  page.on('response', (r) => r.status() >= 400 && onPageError(`HTTP ${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => onPageError(`request failed (${r.failure()?.errorText}) ${r.url()}`));

  const res = await page.goto(url, { waitUntil: 'load' });
  if (res && !res.ok()) throw new Error(`${url} answered HTTP ${res.status()}`);
  await page.waitForFunction(
    () => window.player && typeof window.player.seek === 'function' && window.player.ready,
    null,
    { timeout: PAGE_TIMEOUT_MS },
  ).catch((err) => {
    throw new Error(`window.player was not exposed by ${url} within ${PAGE_TIMEOUT_MS / 1000}s (${err.message.split('\n')[0]})`);
  });
  await page.evaluate(() => window.player.ready);
  const duration = await page.evaluate(() => Number(window.player.duration));
  await page.evaluate(installSeekHelper);

  const cdp = opts.capture === 'cdp' ? await context.newCDPSession(page) : null;
  const clip = { x: 0, y: 0, width: opts.width, height: opts.height };

  const stats = { fontWaits: 0, imageWaits: 0 };
  function count(r) {
    if (r & 1) stats.fontWaits++;
    if (r & 2) stats.imageWaits++;
  }
  async function seek(t) {
    if (cdp) {
      const r = await cdp.send('Runtime.evaluate', {
        expression: `window.__renderSeek(${t})`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(`seek(${t}) threw: ${d.exception?.description ?? d.text}`);
      }
      count(r.result?.value);
    } else {
      count(await page.evaluate((tt) => window.__renderSeek(tt), t));
    }
  }

  /** Seek to t and return the frame as an encoded image Buffer. */
  async function capture(t, format = 'jpeg', quality = opts.quality) {
    await seek(t);
    if (cdp) {
      const { data } = await cdp.send('Page.captureScreenshot', {
        format,
        ...(format === 'jpeg' ? { quality } : {}),
        clip: { ...clip, scale: 1 },
        captureBeyondViewport: false,
        fromSurface: true,
        optimizeForSpeed: true,
      });
      return Buffer.from(data, 'base64');
    }
    return page.screenshot({ type: format, ...(format === 'jpeg' ? { quality } : {}), clip, timeout: 0 });
  }

  return {
    page,
    duration,
    stats,
    seek,
    capture,
    close: () => context.close().catch(() => {}),
  };
}

// Chromium re-rasterises only the damaged region of a frame, so the same DOM reached
// from a different previous frame can differ by +-1 in a few pixels (gradient /
// filter rounding at tile edges). That is invisible and is far below JPEG/x264
// error, so the check tolerates it. Real seek bugs differ by tens to 255.
export const DETERMINISM_MAX_DELTA = 2;

async function compareImages(a, b) {
  if (a.equals(b)) return { identical: true, pixels: 0, maxDelta: 0 };
  const [ra, rb] = await Promise.all([decodeToRgb(a), decodeToRgb(b)]);
  if (ra.length !== rb.length) return { identical: false, pixels: Infinity, maxDelta: 255 };
  let pixels = 0;
  let maxDelta = 0;
  for (let i = 0; i < ra.length; i += 3) {
    const d = Math.max(Math.abs(ra[i] - rb[i]), Math.abs(ra[i + 1] - rb[i + 1]), Math.abs(ra[i + 2] - rb[i + 2]));
    if (d) {
      pixels++;
      if (d > maxDelta) maxDelta = d;
    }
  }
  return { identical: false, pixels, maxDelta };
}

/**
 * Capture sample frames as lossless PNG three times - page A in forward order,
 * a second independent page B in reverse order (jumping elsewhere before each
 * capture), page A again interleaved - and compare. Returns { ok, rows }.
 */
export async function checkDeterminism(browser, url, opts, frames, log = console.log) {
  const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);
  const a = await openRenderPage(browser, url, opts);
  const b = await openRenderPage(browser, url, opts);
  try {
    const pass1 = new Map();
    for (const f of frames) pass1.set(f, await a.capture(f / opts.fps, 'png'));
    const pass2 = new Map();
    const far = frames.at(-1);
    for (const f of [...frames].reverse()) {
      await b.seek((far - f) / opts.fps);
      pass2.set(f, await b.capture(f / opts.fps, 'png'));
    }
    const pass3 = new Map();
    const interleaved = [...frames.filter((_, i) => i % 2), ...frames.filter((_, i) => !(i % 2))];
    for (const f of interleaved) pass3.set(f, await a.capture(f / opts.fps, 'png'));

    const rows = [];
    for (const f of frames) {
      const c2 = await compareImages(pass1.get(f), pass2.get(f));
      const c3 = await compareImages(pass1.get(f), pass3.get(f));
      const worst = c2.maxDelta >= c3.maxDelta ? c2 : c3;
      const ok = worst.maxDelta <= DETERMINISM_MAX_DELTA;
      const verdict = c2.identical && c3.identical
        ? 'identical'
        : `${ok ? 'OK' : 'MISMATCH'}: ${worst.pixels} px differ, max delta ${worst.maxDelta}`;
      rows.push({ frame: f, ok, pass1: sha(pass1.get(f)), pass2: sha(pass2.get(f)), pass3: sha(pass3.get(f)), ...worst });
      log(`  frame ${String(f).padStart(6)}  t=${(f / opts.fps).toFixed(3).padStart(8)}  ${sha(pass1.get(f))} ${sha(pass2.get(f))} ${sha(pass3.get(f))}  ${verdict}`);
    }
    return { ok: rows.every((r) => r.ok), rows };
  } finally {
    await a.close();
    await b.close();
  }
}
