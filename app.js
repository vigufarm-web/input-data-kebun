const get = id => document.getElementById(id);
const apiOrigin = location.hostname === 'vigufarm-web.github.io' ? 'https://laporankebun.vercel.app' : location.origin;
const apiPrefix = apiOrigin + '/api/input-client';
const sessionKey = 'input-kebun-session-v1';
let sessionToken = sessionStorage.getItem(sessionKey) || '';
function inputApi(path) {
  if (!path.startsWith('/api/')) throw new Error('Alamat layanan tidak valid.');
  return apiPrefix + path.slice('/api'.length);
}
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
let availableRoles = {};
let editingUser = null;
let savingUser = false;
let harvestOffset = 0;
let harvestEditing = null;
let harvestSaving = false;
let harvestRequest;
let salesWarningSignature = null;
let currentIsAdmin = false;
let currentRoles = [];
const canUseTable = table => currentRoles.some(role => availableRoles[role]?.edit === '*' || (availableRoles[role]?.edit || []).includes(table));
const bananaTables = ['pisang_panen_pkk','pisang_box','pisang_bibit','pisang_estimasi','pisang_handclass'];
const riceTables = ['padi_panen','padi_giling','padi_benih','padi_rencana'];
const harvestFields = {
  padi_rencana: [
    { key: 'selesai', label: 'Minggu selesai', type: 'date', required: true },
    { key: 'minggu_ke', label: 'Minggu ke', type: 'number', step: '1' },
    { key: 'pekerjaan', label: 'Pekerjaan', type: 'text' },
    { key: 'aktivitas', label: 'Aktivitas', type: 'text', required: true },
    { key: 'rencana', label: 'Rencana', type: 'number', step: 'any' },
    { key: 'satuan', label: 'Satuan', options: ['ha', 'kg', 'HK'] },
    { key: 'realisasi', label: 'Realisasi', type: 'number', step: 'any' },
  ],
  pisang_penjualan: [
    { key: 'no_sj', label: 'No. Surat Jalan', type: 'text' },
    { key: 'gudang', label: 'Asal gudang', type: 'text' },
    { key: 'pembeli', label: 'Pembeli', type: 'text' },
    { key: 'tipe', label: 'Tipe', options: ['Penjualan', 'Sampel', 'Retur', 'Mutasi Internal', 'Ongkir'], required: true },
    { key: 'jenis_barang', label: 'Jenis barang', type: 'text' },
    { key: 'bentuk', label: 'Bentuk', options: ['FH', 'CL', 'SL'] },
    { key: 'kelas', label: 'Kelas', options: ['A', 'B', 'C', 'MIX', 'Reject'] },
    { key: 'kondisi', label: 'Kondisi', options: ['Matang', 'Mentah', 'Reject'] },
    { key: 'jumlah_box', label: 'Jumlah box', type: 'number', step: '1' },
    { key: 'berat_kg', label: 'Berat (kg)', type: 'number', step: 'any' },
    { key: 'harga', label: 'Harga per satuan (Rp)', type: 'number', step: 'any' },
    { key: 'nominal', label: 'Nominal (Rp), kosongkan untuk hitung otomatis', type: 'number', step: 'any' },
    { key: 'dibayar', label: 'Sudah dibayar (Rp)', type: 'number', step: 'any' },
  ],
  padi_penjualan: [
    { key: 'no_sj', label: 'No. Surat Jalan', type: 'text' },
    { key: 'pembeli', label: 'Pembeli / tujuan', type: 'text' },
    { key: 'tipe', label: 'Tipe', options: ['Penjualan', 'Sampel', 'Retur', 'Mutasi Internal', 'Ongkir'] },
    { key: 'jenis', label: 'Jenis', options: ['GKP', 'GKG', 'Beras', 'Dedak/Lainnya'] },
    { key: 'jumlah_sak', label: 'Jumlah sak / box', type: 'number', step: '1' },
    { key: 'berat_kg', label: 'Berat (kg)', type: 'number', required: true, step: 'any' },
    { key: 'harga_kg', label: 'Harga/kg (Rp)', type: 'number', step: 'any' },
    { key: 'nominal', label: 'Nominal (Rp), kosongkan untuk hitung otomatis', type: 'number', step: 'any' },
    { key: 'dibayar', label: 'Sudah dibayar (Rp)', type: 'number', step: 'any' },
  ],
  pisang_panen_pkk: [
    { key: 'fase', label: 'Fase', options: ['PC', 'R1', 'R2', 'R3', 'R4'] },
    { key: 'pkk_panen', label: 'Tandan / pokok dipanen', type: 'number', required: true, step: '1' },
  ],
  pisang_box: [
    { key: 'kelas', label: 'Kelas', options: ['A', 'B', 'C', 'MIX'], required: true },
    { key: 'bentuk', label: 'Bentuk', options: ['FH', 'Cluster', 'Single'] },
    { key: 'jumlah_box', label: 'Jumlah box', type: 'number', required: true, step: '1' },
    { key: 'berat_kg', label: 'Berat (kg)', type: 'number', step: 'any' },
  ],
  pisang_bibit: [
    { key: 'batch', label: 'Batch', type: 'text' },
    { key: 'klon', label: 'Klon / varietas', type: 'text' },
    { key: 'umur_datang_bln', label: 'Umur saat datang (bulan)', type: 'number', step: 'any' },
    { key: 'qty_datang', label: 'Jumlah datang (pokok)', type: 'number', required: true, step: '1' },
    { key: 'afkir', label: 'Total afkir (pokok)', type: 'number', step: '1' },
    { key: 'splitting', label: 'Tambahan splitting (pokok)', type: 'number', step: '1' },
    { key: 'mortal', label: 'Total mati (pokok)', type: 'number', step: '1' },
    { key: 'ditanam', label: 'Total ditanam dari batch (pokok)', type: 'number', step: '1' },
    { key: 'harga_satuan', label: 'Harga/bibit', type: 'number', step: 'any' },
  ],
  pisang_estimasi: [
    { key: 'box', label: 'Estimasi total (box)', type: 'number', required: true, step: '1' },
    { key: 'box_a', label: 'Kelas A (box)', type: 'number', step: '1' },
    { key: 'box_b', label: 'Kelas B (box)', type: 'number', step: '1' },
    { key: 'box_c', label: 'Kelas C (box)', type: 'number', step: '1' },
  ],
  pisang_handclass: [
    { key: 'status', label: 'Status', options: ['PC', 'R1', 'R2', 'R3', 'R4'] },
    { key: 'rata_hand', label: 'Rata-rata hand per tandan', type: 'number', required: true, step: 'any' },
    { key: 'jumlah_sampel', label: 'Jumlah sampel', type: 'number', step: '1' },
  ],
  padi_giling: [
    { key: 'gudang', label: 'Gudang', type: 'text' },
    { key: 'beras_kg', label: 'Beras masuk (kg)', type: 'number', required: true, step: 'any' },
    { key: 'gabah_kg', label: 'Gabah digiling (kg)', type: 'number', step: 'any' },
    { key: 'sumber_panen', label: 'Dari panen', type: 'text' },
    { key: 'tempat_giling', label: 'Tempat giling', type: 'text' },
  ],
  padi_panen: [
    { key: 'jumlah_karung', label: 'Jumlah karung', type: 'number', step: '1' },
    { key: 'gkp_kg', label: 'Gabah / GKP (kg)', type: 'number', required: true, step: 'any' },
    { key: 'gkg_kg', label: 'GKG (kg)', type: 'number', step: 'any' },
  ],
  padi_benih: [
    { key: 'varietas', label: 'Varietas', type: 'text', required: true },
    { key: 'jenis', label: 'Jenis mutasi', options: ['Masuk', 'Pakai', 'Afkir'], required: true },
    { key: 'qty_kg', label: 'Jumlah (kg)', type: 'number', required: true, step: 'any' },
    { key: 'kelas_benih', label: 'Kelas benih', options: ['BS', 'FS', 'SS', 'ES', 'Lainnya'] },
    { key: 'sumber', label: 'Sumber / pemasok', type: 'text' },
    { key: 'harga_kg', label: 'Harga/kg', type: 'number', step: 'any' },
  ],
  iklim: [
    { key: 'jam', label: 'Jam (JJ:MM)', type: 'text', required: true },
    { key: 'angin_ms', label: 'Angin (m/s)', type: 'number', step: 'any' },
    { key: 'arah', label: 'Arah angin', type: 'text' },
    { key: 'hujan_mm', label: 'Hujan kumulatif (mm)', type: 'number', step: 'any' },
    { key: 'suhu_dalam', label: 'Suhu dalam (°C)', type: 'number', step: 'any', allowNegative: true },
    { key: 'lembap_dalam', label: 'Kelembapan dalam (%)', type: 'number', step: 'any' },
    { key: 'suhu_luar', label: 'Suhu luar (°C)', type: 'number', step: 'any', allowNegative: true },
    { key: 'lembap_luar', label: 'Kelembapan luar (%)', type: 'number', step: 'any' },
  ],
};

function message(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('error', error);
}

async function request(path, method = 'GET', data) {
  const response = await fetch(inputApi(path), {
    method,
    credentials: 'omit',
    headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(sessionToken ? { Authorization: 'Bearer ' + sessionToken } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (response.status === 401 && path === '/api/me') { sessionStorage.removeItem(sessionKey); sessionToken = ''; return { user: null, roles: {} }; }
  if (!response.ok || !result) throw new Error(result?.error || 'Layanan Input Data Kebun belum dapat dihubungi.');
  if (path === '/api/login') { sessionToken = result.token; sessionStorage.setItem(sessionKey, sessionToken); }
  if (path === '/api/logout') { sessionToken = ''; sessionStorage.removeItem(sessionKey); }
  return result;
}

async function downloadExcel(table) {
  const response = await fetch(inputApi('/api/excel/download?tables=' + encodeURIComponent(table)), { credentials: 'omit', headers: { Authorization: 'Bearer ' + sessionToken } });
  if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.error || 'Excel belum dapat diunduh.'); }
  const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'Data Kebun - ' + table + '.xlsx'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  const { user, roles } = await request('/api/me');
  availableRoles = roles || {};
  login.hidden = Boolean(user);
  dashboard.hidden = !user;
  progress.hidden = true;
  if (!user) {
    message(status, 'Masuk dengan akun Laporan Kebun.');
    return;
  }
  const admin = user.peran.includes('admin');
  const mandor = user.peran.some(role => role.startsWith('daily_'));
  const sales = !mandor && user.peran.includes('penjualan');
  currentIsAdmin = admin;
  currentRoles = user.peran;
  get('open-progress').hidden = !canUseTable('lahan_harian');
  get('open-users').hidden = !admin;
  get('open-harvest').hidden = !bananaTables.some(canUseTable);
  get('open-milling').hidden = !riceTables.some(canUseTable);
  get('open-climate').hidden = !canUseTable('iklim');
  get('open-sales').hidden = !admin && !sales;
  get('open-daily').hidden = !admin && !mandor;
  get('dashboard-title').textContent = admin ? 'Dashboard Admin' : mandor ? 'Dashboard Mandor' : sales ? 'Dashboard Penjualan' : 'Dashboard';
  get('add').disabled = !canUseTable('lahan_harian');
  message(status, `Masuk sebagai ${user.nama || user.username}.`);
  if (canUseTable('lahan_harian')) await refresh();
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

async function refreshUsers() {
  const list = await request('/api/users');
  const rows = list.map(user => {
    const tr = document.createElement('tr');
    for (const value of [user.nama, user.username, user.peran.map(role => availableRoles[role]?.label || role).join(', '), user.aktif ? 'Aktif' : 'Nonaktif']) {
      tr.insertCell().textContent = value || '—';
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Ubah';
    button.addEventListener('click', () => openUserEditor(user));
    tr.insertCell().append(button);
    return tr;
  });
  get('user-rows').replaceChildren(...rows);
}

function openUserEditor(user = null) {
  const form = get('user-entry');
  editingUser = user;
  form.reset();
  get('user-title').textContent = user ? 'Ubah pengguna' : 'Tambah pengguna';
  form.elements.nama.value = user?.nama || '';
  form.elements.username.value = user?.username || '';
  form.elements.username.disabled = Boolean(user);
  form.elements.username.required = !user;
  form.elements.password.required = !user;
  form.elements.aktif.checked = user ? Boolean(user.aktif) : true;
  get('user-active-label').hidden = !user;
  get('user-password-label').firstChild.textContent = user ? 'Kata sandi baru (kosongkan jika tetap) ' : 'Kata sandi ';
  const roleElements = Object.entries(availableRoles).map(([key, role]) => {
    const label = document.createElement('label');
    const line = document.createElement('span');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'peran';
    checkbox.value = key;
    checkbox.checked = user?.peran.includes(key) || false;
    checkbox.style.width = 'auto';
    line.append(checkbox, document.createTextNode(' ' + role.label + ' — ' + role.desc));
    label.append(line);
    return label;
  });
  get('user-roles').replaceChildren(...roleElements);
  message(get('user-message'), '');
  get('user-editor').showModal();
}

get('open-users').addEventListener('click', async () => {
  try {
    await refreshUsers();
    dashboard.hidden = true;
    get('users').hidden = false;
  } catch (error) {
    message(status, error.message, true);
  }
});
get('users-back').addEventListener('click', () => { get('users').hidden = true; dashboard.hidden = false; });

async function refreshHarvest() {
  const token = Symbol();
  harvestRequest = token;
  const table = get('harvest-type').value;
  const sort = table === 'pisang_bibit' ? '-tanggal_datang' : table === 'pisang_estimasi' ? '-bulan' : table === 'padi_rencana' ? '-mulai' : '-tanggal';
  const params = new URLSearchParams({ limit: pageSize, offset: harvestOffset, sort });
  try {
    const data = await request('/api/records/' + table + '?' + params);
    if (harvestRequest !== token) return;
    const headings = [table === 'pisang_bibit' ? 'Tanggal datang' : table === 'pisang_estimasi' ? 'Bulan' : table === 'padi_rencana' ? 'Minggu mulai' : 'Tanggal', ...(['pisang_bibit', 'pisang_estimasi', 'padi_giling', 'padi_benih', 'iklim', 'pisang_penjualan'].includes(table) ? [] : [table.startsWith('padi_') ? 'Petak' : 'Blok']), ...harvestFields[table].map(field => field.label), ...(table === 'padi_benih' ? ['Saldo varietas saat ini (kg)'] : table === 'pisang_bibit' ? ['Saldo batch (pokok)'] : table.endsWith('_penjualan') ? ['Total (Rp)'] : []), 'Keterangan', 'Aksi'];
    const header = document.createElement('tr');
    for (const label of headings) {
      const th = document.createElement('th');
      th.textContent = label;
      header.append(th);
    }
    get('harvest-head').replaceChildren(header);
    const rows = data.rows.map(row => {
      const tr = document.createElement('tr');
      const date = table === 'pisang_bibit' ? row.tanggal_datang : table === 'pisang_estimasi' ? row.bulan : table === 'padi_rencana' ? row.mulai : row.tanggal;
      for (const value of [date, ...(['pisang_bibit', 'pisang_estimasi', 'padi_giling', 'padi_benih', 'iklim', 'pisang_penjualan'].includes(table) ? [] : [table.startsWith('padi_') ? row.petak : row.blok]), ...harvestFields[table].map(field => row[field.key]), ...(table === 'padi_benih' ? [row.saldo_varietas] : table === 'pisang_bibit' ? [row.saldo] : table.endsWith('_penjualan') ? [row.total] : []), row.keterangan]) {
        tr.insertCell().textContent = value ?? '—';
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Revisi';
      button.addEventListener('click', () => openHarvestEditor(row));
      tr.insertCell().append(button);
      return tr;
    });
    get('harvest-rows').replaceChildren(...rows);
    get('harvest-range').textContent = data.total ? `${data.offset + 1}–${data.offset + data.rows.length} dari ${data.total}` : 'Belum ada data';
    get('harvest-prev').disabled = data.offset === 0;
    get('harvest-next').disabled = data.offset + data.rows.length >= data.total;
  } catch (error) {
    if (harvestRequest === token) message(status, error.message, true);
  }
}

async function openHarvestEditor(row = null) {
  const form = get('harvest-entry');
  const table = get('harvest-type').value;
  harvestEditing = row;
  form.reset();
  salesWarningSignature = null;
  get('sales-warning').hidden = true;
  get('sales-warning-confirm').checked = false;
  const title = table === 'padi_rencana' ? 'rencana mingguan Padi' : table === 'pisang_penjualan' ? 'penjualan Pisang' : table === 'padi_penjualan' ? 'penjualan Padi' : table === 'pisang_handclass' ? 'Hand Class Pisang' : table === 'pisang_estimasi' ? 'estimasi panen Pisang' : table === 'pisang_bibit' ? 'batch bibit Pisang' : table === 'iklim' ? 'data iklim' : table === 'padi_benih' ? 'mutasi benih Padi' : table === 'padi_giling' ? 'penggilingan' : table === 'pisang_box' ? 'packing' : table === 'padi_panen' ? 'panen Padi' : 'panen';
  get('harvest-title').textContent = (row ? 'Revisi ' : 'Tambah ') + title;
  const dateValue = table === 'pisang_bibit' ? row?.tanggal_datang : table === 'pisang_estimasi' ? row?.bulan : table === 'padi_rencana' ? row?.mulai : row?.tanggal;
  form.elements.tanggal.value = row ? dateValue ?? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  get('harvest-date-label').textContent = table === 'pisang_estimasi' ? 'Bulan target (pilih tanggal dalam bulan)' : table === 'padi_rencana' ? 'Minggu mulai' : 'Tanggal';
  form.elements.tanggal.required = !(table === 'padi_panen' && row && !row.tanggal);
  form.elements.keterangan.value = row?.keterangan ?? '';
  form.elements.blok.required = table === 'pisang_panen_pkk' || table === 'pisang_handclass' || table === 'padi_panen';
  get('harvest-block-caption').textContent = table.startsWith('padi_') ? 'Petak' : 'Blok';
  const skipBlock = ['pisang_bibit', 'pisang_estimasi', 'padi_giling', 'padi_benih', 'iklim', 'pisang_penjualan'].includes(table) || (table === 'padi_penjualan' && !currentIsAdmin);
  get('harvest-block-label').hidden = skipBlock;
  form.elements.blok.disabled = skipBlock;
  const fields = harvestFields[table].map(field => {
    const label = document.createElement('label');
    label.append(document.createTextNode(field.label));
    const input = document.createElement(field.options ? 'select' : 'input');
    input.name = field.key;
    input.required = Boolean(field.required);
    if (field.options) setOptions(input, field.options, row?.[field.key]);
    else {
      input.type = field.type;
      if (field.type === 'number') {
        if (!field.allowNegative) input.min = '0';
        input.step = field.step;
      }
      input.value = row?.[field.key] ?? '';
    }
    label.append(input);
    return label;
  });
  get('harvest-fields').replaceChildren(...fields);
  message(get('harvest-message'), 'Memuat blok…');
  get('harvest-save').disabled = true;
  get('harvest-editor').showModal();
  if (skipBlock) {
    message(get('harvest-message'), '');
    get('harvest-save').disabled = false;
    return;
  }
  try {
    const locations = await request('/api/daily/locations');
    if (!get('harvest-editor').open) return;
    const division = table.startsWith('padi_') ? 'Padi' : 'Pisang';
    setOptions(form.elements.blok, locations.filter(b => b.blok_id && b.divisi === division).map(b => b.nama), table.startsWith('padi_') ? row?.petak : row?.blok);
    message(get('harvest-message'), '');
    get('harvest-save').disabled = false;
  } catch (error) {
    message(get('harvest-message'), error.message, true);
  }
}

get('open-harvest').addEventListener('click', () => {
  dashboard.hidden = true;
  get('harvest').hidden = false;
  get('harvest-section-title').textContent = 'Pisang · Bibit, Panen & Packing';
  get('harvest-description').textContent = 'Catat batch bibit, panen per blok, dan hasil packing per kelas.';
  get('harvest-type-label').hidden = false;
  for (const option of get('harvest-type').options) option.hidden = !bananaTables.includes(option.value) || !canUseTable(option.value);
  get('harvest-type').value = bananaTables.find(canUseTable);
  harvestOffset = 0;
  refreshHarvest();
});
get('open-milling').addEventListener('click', () => {
  dashboard.hidden = true;
  get('harvest').hidden = false;
  get('harvest-section-title').textContent = 'Padi · Benih, Panen & Rencana';
  get('harvest-description').textContent = 'Catat mutasi benih, gabah per petak, dan beras yang masuk setelah digiling.';
  get('harvest-type-label').hidden = false;
  for (const option of get('harvest-type').options) option.hidden = !riceTables.includes(option.value) || !canUseTable(option.value);
  get('harvest-type').value = riceTables.find(canUseTable);
  harvestOffset = 0;
  refreshHarvest();
});
get('open-sales').addEventListener('click', () => {
  location.href = 'https://vigufarm-web.github.io/penjualan/';
});
get('open-climate').addEventListener('click', () => {
  dashboard.hidden = true;
  get('harvest').hidden = false;
  get('harvest-section-title').textContent = 'Iklim';
  get('harvest-description').textContent = 'Isi pembacaan alat per tanggal dan jam. Hujan harian menggunakan nilai kumulatif terbesar hari itu.';
  get('harvest-type-label').hidden = true;
  get('harvest-type').value = 'iklim';
  harvestOffset = 0;
  refreshHarvest();
});
get('harvest-back').addEventListener('click', () => { harvestRequest = null; get('harvest').hidden = true; dashboard.hidden = false; });
get('harvest-type').addEventListener('change', () => { harvestOffset = 0; refreshHarvest(); });
get('harvest-prev').addEventListener('click', () => { harvestOffset = Math.max(0, harvestOffset - pageSize); refreshHarvest(); });
get('harvest-next').addEventListener('click', () => { harvestOffset += pageSize; refreshHarvest(); });
get('harvest-add').addEventListener('click', () => openHarvestEditor());
get('harvest-excel').addEventListener('click', () => downloadExcel(get('harvest-type').value).catch(error => message(status, error.message, true)));
get('progress-excel').addEventListener('click', () => downloadExcel('lahan_harian').catch(error => message(status, error.message, true)));
get('harvest-cancel').addEventListener('click', () => get('harvest-editor').close());
get('harvest-editor').addEventListener('cancel', event => { if (harvestSaving) event.preventDefault(); });

async function findSameSalesDocument(table, noSj) {
  const sj = (noSj || '').trim();
  if (!sj) return [];
  const matches = [];
  for (let offset = 0; ; offset += 100) {
    const query = new URLSearchParams({ q: sj, limit: '100', offset: String(offset) });
    const page = await request('/api/records/' + table + '?' + query);
    matches.push(...page.rows.filter(row => String(row.no_sj || '').trim().toLocaleUpperCase('id-ID') === sj.toLocaleUpperCase('id-ID') && row.id !== harvestEditing?.id));
    if (offset + page.rows.length >= page.total) break;
    if (!page.rows.length || offset >= 9900) throw new Error('Pemeriksaan surat jalan belum selesai. Coba lagi.');
  }
  return matches;
}

get('harvest-entry').addEventListener('submit', async event => {
  event.preventDefault();
  if (harvestSaving) return;
  const form = event.currentTarget;
  const table = get('harvest-type').value;
  const data = Object.fromEntries(new FormData(form));
  if (table === 'pisang_bibit') {
    data.tanggal_datang = data.tanggal;
    delete data.tanggal;
  }
  if (table === 'pisang_estimasi') {
    data.bulan = data.tanggal;
    delete data.tanggal;
  }
  if (['padi_panen', 'padi_penjualan', 'padi_rencana'].includes(table)) {
    if ('blok' in data) data.petak = data.blok;
    delete data.blok;
  }
  if (table === 'padi_rencana') {
    data.mulai = data.tanggal;
    delete data.tanggal;
    if (data.selesai < data.mulai) {
      message(get('harvest-message'), 'Minggu selesai tidak boleh sebelum minggu mulai.', true);
      return;
    }
  }
  for (const field of harvestFields[table].filter(field => field.type === 'number')) {
    data[field.key] = data[field.key] === '' ? null : Number(data[field.key]);
  }
  harvestSaving = true;
  get('harvest-save').disabled = true;
  get('harvest-cancel').disabled = true;
  try {
    if (table.endsWith('_penjualan')) {
      const existing = await findSameSalesDocument(table, data.no_sj);
      const needsWarning = existing.length > 0 || !String(data.no_sj || '').trim();
      const signature = JSON.stringify({ data, matches: existing.map(row => [row.id, row.updated_at]) });
      if (needsWarning && (signature !== salesWarningSignature || !get('sales-warning-confirm').checked)) {
        salesWarningSignature = signature;
        get('sales-warning-confirm').checked = false;
        const details = existing.slice(0, 3).map(row => [row.tanggal, row.pembeli, row.jenis_barang || row.jenis || row.tipe].filter(Boolean).join(' · ')).join('; ');
        get('sales-warning-text').textContent = existing.length
          ? `Nomor SJ sudah ada pada ${existing.length} baris: ${details}. Periksa apakah rincian ini tambahan yang sah. Untuk mengubah data lama, pilih Revisi pada baris lama.`
          : 'Nomor SJ kosong sehingga tidak dapat diperiksa kesamaannya. Periksa daftar penjualan sebelum menyimpan.';
        get('sales-warning').hidden = false;
        message(get('harvest-message'), 'Centang persetujuan setelah memeriksa, lalu tekan Simpan lagi.', true);
        return;
      }
    }
    if (harvestEditing) await request('/api/t/' + table + '/' + harvestEditing.id, 'PUT', { ...data, updated_at: harvestEditing.updated_at ?? null });
    else await request('/api/t/' + table, 'POST', data);
    get('harvest-editor').close();
    harvestOffset = 0;
    await refreshHarvest();
    message(status, 'Data tersimpan.');
  } catch (error) {
    message(get('harvest-message'), error.message, true);
  } finally {
    harvestSaving = false;
    get('harvest-save').disabled = false;
    get('harvest-cancel').disabled = false;
  }
});
get('user-add').addEventListener('click', () => openUserEditor());
get('user-cancel').addEventListener('click', () => get('user-editor').close());
get('user-editor').addEventListener('cancel', event => { if (savingUser) event.preventDefault(); });
get('user-entry').addEventListener('submit', async event => {
  event.preventDefault();
  if (savingUser) return;
  const form = event.currentTarget;
  const roles = [...form.querySelectorAll('input[name="peran"]:checked')].map(input => input.value);
  if (!roles.length) return message(get('user-message'), 'Pilih minimal satu peran.', true);
  const data = { nama: form.elements.nama.value.trim(), peran: roles };
  if (editingUser) data.aktif = form.elements.aktif.checked ? 1 : 0;
  else data.username = form.elements.username.value.trim();
  if (form.elements.password.value) data.password = form.elements.password.value;
  savingUser = true;
  get('user-save').disabled = true;
  get('user-cancel').disabled = true;
  try {
    await request(editingUser ? '/api/users/' + editingUser.id : '/api/users', editingUser ? 'PUT' : 'POST', data);
    form.elements.password.value = '';
    get('user-editor').close();
    await refreshUsers();
    message(status, 'Pengguna tersimpan.');
  } catch (error) {
    message(get('user-message'), error.message, true);
  } finally {
    savingUser = false;
    get('user-save').disabled = false;
    get('user-cancel').disabled = false;
  }
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
