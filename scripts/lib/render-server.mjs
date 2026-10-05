// Tiny static file server used by scripts/render.mjs when nothing is serving
// the render URL yet. Read-only, GET/HEAD only, confined to `root`.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

/** Resolve true if `url` answers with HTTP < 400 within `timeoutMs`. */
export async function isServing(url, timeoutMs = 1500) {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    await res.body?.cancel();
    return res.status < 400;
  } catch {
    return false;
  }
}

/**
 * Start a static server over `root`. Tries `port` first; if it is taken
 * (another server raced us) falls back to an ephemeral port.
 * Resolves { server, port, close() }.
 */
export async function startStaticServer(root, port, host = '127.0.0.1') {
  const rootAbs = path.resolve(root);
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.resolve(rootAbs, '.' + urlPath);
      if (file !== rootAbs && !file.startsWith(rootAbs + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let st = await stat(file).catch(() => null);
      if (st?.isDirectory()) {
        file = path.join(file, 'index.html');
        st = await stat(file).catch(() => null);
      }
      if (!st?.isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      const headers = { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
      // Range support so <audio>/<video> elements behave if the page uses them.
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (range && (range[1] || range[2])) {
        let start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
        let end = range[1] && range[2] ? Number(range[2]) : st.size - 1;
        start = Math.max(0, start);
        end = Math.min(st.size - 1, end);
        if (start > end) {
          res.writeHead(416, { 'content-range': `bytes */${st.size}` }).end();
          return;
        }
        res.writeHead(206, { ...headers, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${st.size}` });
        if (req.method === 'HEAD') return res.end();
        createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { ...headers, 'content-length': st.size });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    } catch (err) {
      if (!res.headersSent) res.writeHead(500);
      res.end(String(err));
    }
  });

  const listen = (p) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(server.address().port);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(p, host);
    });

  let actualPort;
  try {
    actualPort = await listen(port);
  } catch (err) {
    if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') throw err;
    actualPort = await listen(0);
  }
  return {
    server,
    port: actualPort,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
