import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) throw Error('Atur DEMO_PASSWORD dengan minimal 12 karakter.');
const username = process.env.DEMO_USERNAME || 'admin-demo';
const publicOrigin = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (process.env.RENDER && !publicOrigin) throw Error('Alamat HTTPS Render belum tersedia.');
const backendDir = resolve(process.env.KEBUN_DEMO_BACKEND_DIR || '.demo-backend');
const dataDir = await mkdtemp(join(tmpdir(), 'input-kebun-demo-'));

const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const backendPort = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const api = 'http://127.0.0.1:' + backendPort;
const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR'].map(key => [key, process.env[key]]).filter(([, value]) => value));
const backend = spawn(process.execPath, ['server.js'], {
  cwd: backendDir,
  env: { ...env, PORT: String(backendPort), DATA_BACKEND: 'local', DATA_DIR: dataDir, EXCEL_FILE: join(dataDir, 'demo.xlsx') },
  stdio: 'inherit',
});
const children = [backend];
function stop(code) {
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));

let cookie;
async function call(path, body) {
  const response = await fetch(api + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8_000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'API uji gagal.');
  if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return result;
}

try {
  let health;
  for (let i = 0; i < 80; i++) {
    if (backend.exitCode !== null) throw Error('API uji berhenti sebelum siap.');
    try { health = await call('/api/me'); break; } catch { await setTimeout(250); }
  }
  if (!health?.setup || health.online) throw Error('API uji harus memakai database lokal baru.');
  await call('/api/setup', { username, password, nama: 'Admin Uji' });
  const feature = {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[109, -7], [109.001, -7], [109.001, -7.001], [109, -7.001], [109, -7]]] },
    properties: { Nama_Blok: 'UJI-01', Lahan: 'Pisang', kepemilikan: 'Sudah milik kebun' },
  };
  const layer = {
    nama: 'Blok Simulasi', jenis: 'Blok Tanam', field_nama: 'Nama_Blok', tampil: 1, warna: '#245c3c',
    geojson: JSON.stringify({ type: 'FeatureCollection', features: [feature] }),
  };
  const preview = await call('/api/gis/revision', { layer });
  if (preview.errors?.length) throw Error('Blok simulasi gagal divalidasi: ' + preview.errors.join(', '));
  await call('/api/gis/revision', { layer, mode: 'apply', token: preview.token });
  const locations = await call('/api/daily/locations');
  if (!locations.some(row => row.nama === 'UJI-01' && row.blok_id)) throw Error('Blok simulasi belum tersedia.');
  const { total } = await call('/api/records/lahan_harian?limit=1');
  if (total !== 0) throw Error('Data awal progres simulasi harus kosong.');

  const web = spawn(process.execPath, ['server.mjs'], {
    env: { ...env, PORT: process.env.PORT || '8090', KEBUN_API_ORIGIN: api, DEMO_MODE: '1', ...(publicOrigin ? { PUBLIC_ORIGIN: publicOrigin } : {}) },
    stdio: 'inherit',
  });
  children.push(web);
  for (const child of children) child.once('exit', code => stop(code || 1));
} catch (error) {
  console.error(error.message);
  stop(1);
}
