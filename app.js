const get = id => document.getElementById(id);
const login = get('login');
const dashboard = get('dashboard');
const progress = get('progress');
const editor = get('editor');
const entry = get('entry');
const search = get('search');
const status = get('status');
const tablePath = '/api/t/lahan_harian';
const pageSize = 50;
const areaFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 8 });
let offset = 0;
let editing = null;
let pageRequest;
let saving = false;

function message(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('error', error);
}

async function request(path, method = 'GET', data) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || 'Layanan Input Data Kebun belum dapat dihubungi.');
  return result;
}

function renderRow(row) {
  const tr = document.createElement('tr');
  for (const value of [row.tanggal, row.aktivitas, row.blok, row.hasil_ha == null ? null : areaFormat.format(row.hasil_ha), row.keterangan]) {
    tr.insertCell().textContent = value ?? '—';
  }
  const action = tr.insertCell();
  if (row.daily_report_id) {
    action.textContent = 'Dari Daily Mandor';
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Revisi';
    button.addEventListener('click', () => openEditor(row));
    action.append(button);
  }
  return tr;
}

async function refresh() {
  const current = Symbol();
  pageRequest = current;
  const params = new URLSearchParams({ limit: pageSize, offset, sort: '-tanggal', q: search.elements.q.value.trim() });
  try {
    const data = await request('/api/records/lahan_harian?' + params);
    if (current !== pageRequest) return;
    if (!params.get('q')) get('progress-count').textContent = `${new Intl.NumberFormat('id-ID').format(data.total)} catatan`;
    get('rows').replaceChildren(...data.rows.map(renderRow));
    get('range').textContent = data.total ? `${data.offset + 1}–${data.offset + data.rows.length} dari ${data.total}` : 'Belum ada hasil';
    get('previous').disabled = data.offset === 0;
    get('next').disabled = data.offset + data.rows.length >= data.total;
  } catch (error) {
    if (current === pageRequest) message(status, error.message, true);
  }
}

function setOptions(select, names, existing) {
  const options = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  if (existing && !options.includes(existing)) options.unshift(existing);
  select.replaceChildren(new Option('Pilih…', ''), ...options.map(name => new Option(name, name)));
  select.value = existing ?? '';
}

async function openEditor(row = null) {
  if (editor.open) return;
  editing = row;
  entry.reset();
  get('edit-title').textContent = row ? 'Revisi progres harian' : 'Tambah progres harian';
  message(get('edit-message'), 'Memuat pilihan…');
  get('save').disabled = true;
  editor.showModal();
  const editorRow = row;
  try {
    const [activities, locations] = await Promise.all([request('/api/t/lahan_aktivitas'), request('/api/daily/locations')]);
    if (!editor.open || editing !== editorRow) return;
    setOptions(entry.elements.aktivitas, activities.map(a => a.aktivitas).filter(Boolean), row?.aktivitas);
    setOptions(entry.elements.blok, locations.filter(b => b.blok_id).map(b => b.nama), row?.blok);
    entry.elements.tanggal.value = row?.tanggal ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    entry.elements.hasil_ha.value = row?.hasil_input_ha ?? row?.hasil_ha ?? '';
    entry.elements.keterangan.value = row?.keterangan ?? '';
    message(get('edit-message'), '');
    get('save').disabled = false;
  } catch (error) {
    message(get('edit-message'), error.message, true);
  }
}

async function showSession() {
  const { user } = await request('/api/me');
  login.hidden = Boolean(user);
  dashboard.hidden = !user;
  progress.hidden = true;
  if (!user) {
    message(status, 'Masuk dengan akun Laporan Kebun.');
    return;
  }
  if (!user.peran.includes('admin')) {
    get('add').disabled = true;
    get('open-progress').disabled = true;
    message(status, 'Progres Harian tahap pertama tersedia untuk admin. Gunakan Dashboard Laporan Kebun untuk modul sesuai akses Anda.', true);
    return;
  }
  get('add').disabled = false;
  get('open-progress').disabled = false;
  message(status, `Masuk sebagai ${user.nama || user.username}.`);
  await refresh();
}

login.addEventListener('submit', async event => {
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/login', 'POST', Object.fromEntries(new FormData(login)));
    login.reset();
    await showSession();
  } catch (error) {
    message(status, error.message, true);
  } finally {
    button.disabled = false;
  }
});

get('logout').addEventListener('click', async () => {
  try {
    await request('/api/logout', 'POST');
    pageRequest = null;
    get('rows').replaceChildren();
    offset = 0;
    search.reset();
    await showSession();
  } catch (error) {
    message(status, error.message, true);
  }
});

get('open-progress').addEventListener('click', () => {
  dashboard.hidden = true;
  progress.hidden = false;
});
get('back-dashboard').addEventListener('click', () => {
  progress.hidden = true;
  dashboard.hidden = false;
  offset = 0;
  search.reset();
  refresh();
});

entry.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || get('save').disabled) return;
  saving = true;
  get('save').disabled = true;
  get('cancel').disabled = true;
  const data = Object.fromEntries(new FormData(entry));
  data.hasil_ha = Number(data.hasil_ha);
  const row = editing;
  try {
    if (row) {
      await request(tablePath + '/' + row.id, 'PUT', { ...data, updated_at: row.updated_at ?? null });
    } else {
      await request(tablePath, 'POST', data);
    }
    editor.close();
    message(status, 'Progres tersimpan. Muat ulang daftar…');
    offset = 0;
    search.reset();
    await refresh();
    if (!status.classList.contains('error')) message(status, 'Progres tersimpan.');
  } catch (error) {
    message(get('edit-message'), error.message, true);
  } finally {
    saving = false;
    get('save').disabled = false;
    get('cancel').disabled = false;
  }
});

editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
get('cancel').addEventListener('click', () => editor.close());
get('add').addEventListener('click', () => openEditor());
search.addEventListener('submit', event => { event.preventDefault(); offset = 0; refresh(); });
get('previous').addEventListener('click', () => { offset = Math.max(0, offset - pageSize); refresh(); });
get('next').addEventListener('click', () => { offset += pageSize; refresh(); });
showSession().catch(error => message(status, error.message, true));
