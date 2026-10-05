#!/usr/bin/env node
// Screenshot the render-mode stage at given times.
//   node scripts/snap.mjs 2 15 40 70           → out/snaps/t2.png …
//   node scripts/snap.mjs --range 100 120 2    → every 2 s from 100 to 120
//   node scripts/snap.mjs --check 100 300      → determinism check (seek 100, seek 300, seek 100; compare hashes)
//   options: --url http://localhost:5173/index.html  --out out/snaps
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
let url = 'http://localhost:5173/index.html';
let out = 'out/snaps';
let check = null;
const times = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--url') url = args[++i];
  else if (a === '--out') out = args[++i];
  else if (a === '--range') {
    const s = +args[++i], e = +args[++i], st = +args[++i] || 1;
    for (let t = s; t <= e + 1e-9; t += st) times.push(Math.round(t * 1000) / 1000);
  } else if (a === '--check') { check = [+args[++i], +args[++i]]; }
  else times.push(+a);
}
fs.mkdirSync(out, { recursive: true });

// --disable-partial-raster: always repaint whole tiles, so a frame's pixels never depend on
// which frame was painted before (gradients/dithering otherwise differ slightly after jumps)
const browser = await chromium.launch({ args: ['--disable-partial-raster'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'render=1', { waitUntil: 'load' });
const ok = await Promise.race([
  page.evaluate(() => window.player.ready.then(() => true, (e) => 'rejected: ' + e)),
  new Promise((r) => setTimeout(() => r('timeout waiting for player.ready'), 60000))
]);
if (ok !== true) { console.log('NOT READY:', ok, '\n' + errors.join('\n')); await browser.close(); process.exit(1); }
const duration = await page.evaluate(() => window.player.duration);
console.log('duration', duration.toFixed(2));

async function shot(t, file) {
  await page.evaluate((t) => window.player.seek(t), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  return crypto.createHash('md5').update(buf).digest('hex');
}

if (check) {
  const [a, b] = check;
  const h1 = await shot(a, path.join(out, `check-a-${a}.png`));
  await shot(b, path.join(out, `check-mid-${b}.png`));
  const h2 = await shot(a, path.join(out, `check-b-${a}.png`));
  console.log(`t=${a} direct: ${h1}\nt=${a} after ${b}: ${h2}\n${h1 === h2 ? 'IDENTICAL ✓' : 'DIFFERENT ✗'}`);
}
for (const t of times) {
  const f = path.join(out, `t${t}.png`);
  await shot(t, f);
  console.log('wrote', f);
}
if (errors.length) console.log('console errors/warnings:\n' + errors.join('\n'));
else console.log('no console errors');
await browser.close();
