import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT || 8090);
const upstream = new URL(process.env.KEBUN_API_ORIGIN || 'http://127.0.0.1:3000');
const publicOrigin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN) : null;
const demoMode = process.env.DEMO_MODE === '1';
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

if (upstream.protocol !== 'https:' && !(upstream.protocol === 'http:' && loopback.has(upstream.hostname))) {
  throw new Error('KEBUN_API_ORIGIN harus HTTPS atau server uji lokal.');
}
if (upstream.hostname.endsWith('.vercel.app')) {
  throw new Error('Gunakan layanan Input Data Kebun di luar Vercel.');
}
if (publicOrigin && publicOrigin.protocol !== 'https:') throw new Error('PUBLIC_ORIGIN harus HTTPS.');

const staticFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
]);
const readRoutes = new Set([
  '/api/me', '/api/records/lahan_harian', '/api/t/lahan_aktivitas', '/api/daily/locations', '/api/users',
]);
const writeRoutes = new Set(['/api/login', '/api/logout', '/api/t/lahan_harian', '/api/users']);

function reply(response, code, error) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ error }));
}

function forward(req, res, path) {
  const headers = {};
  for (const key of ['cookie', 'content-type', 'content-length']) {
    if (req.headers[key] !== undefined) headers[key] = req.headers[key];
  }
  const transport = upstream.protocol === 'https:' ? https : http;
  const request = transport.request(new URL(path, upstream), { method: req.method, headers, timeout: 60_000 }, response => {
    const result = { 'Cache-Control': 'no-store' };
    for (const key of ['content-type', 'content-length', 'content-disposition']) {
      if (response.headers[key] !== undefined) result[key] = response.headers[key];
    }
    if (response.headers['set-cookie']) {
      result['Set-Cookie'] = response.headers['set-cookie'].map(cookie =>
        publicOrigin && !/;\s*secure(?:;|$)/i.test(cookie) ? cookie + '; Secure' : cookie);
    }
    res.writeHead(response.statusCode, result);
    response.pipe(res);
    response.on('error', () => res.destroy());
  });
  request.on('timeout', () => request.destroy());
  request.on('error', () => {
    if (res.headersSent) res.destroy();
    else reply(res, 502, 'Layanan data belum tersedia. Periksa daftar sebelum mengulangi simpan.');
  });
  req.on('aborted', () => request.destroy());
  req.pipe(request);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  const file = staticFiles.get(pathname);
  if (file && req.method === 'GET') {
    try {
      let bytes = await readFile(new URL(file[0], import.meta.url), 'utf8');
      if (pathname === '/' && demoMode) {
        bytes = bytes.replace('<h1>Input Data Kebun</h1>', '<h1>Input Data Kebun</h1><p><strong>Lingkungan uji.</strong> Gunakan akun dan data simulasi. Data uji direset saat layanan dimulai ulang.</p>');
      }
      res.writeHead(200, {
        'Content-Type': file[1] + '; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      });
      res.end(bytes);
    } catch {
      reply(res, 500, 'Berkas aplikasi belum tersedia.');
    }
    return;
  }
  const isExcel = pathname === '/api/excel/download' && url.searchParams.getAll('tables').join() === 'lahan_harian';
  const readable = req.method === 'GET' && (readRoutes.has(pathname) || isExcel);
  const writable = req.method === 'POST' && writeRoutes.has(pathname) ||
    req.method === 'PUT' && (/^\/api\/t\/lahan_harian\/\d+$/.test(pathname) || /^\/api\/users\/\d+$/.test(pathname));
  if (!readable && !writable) return reply(res, 404, 'Halaman tidak ditemukan.');
  const origin = publicOrigin?.origin || `http://${req.headers.host}`;
  if (writable && req.headers.origin && req.headers.origin !== origin) return reply(res, 403, 'Asal permintaan tidak diizinkan.');
  forward(req, res, pathname + url.search);
});

server.listen(port, publicOrigin ? '0.0.0.0' : '127.0.0.1');
