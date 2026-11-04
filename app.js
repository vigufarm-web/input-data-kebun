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
const areaFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });
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
let recentlySaved = null;
let progressLocations = [];
let convertedArea = null;
const numberID = new Intl.NumberFormat('id-ID', {maximumFractionDigits: 3});
function showInputSummary(element, data, note = '') {
  element.replaceChildren();
  const title=document.createElement('strong'); title.textContent=`Ringkasan · ${numberID.format(data.total)} catatan`;
  const info=document.createElement('p'); info.textContent=note || 'Ringkasan seluruh catatan pada jenis data ini.';
  const box=document.createElement('div'); box.className='summary-scroll';
  for(const row of data.summary?.rows || []) {
    const line=document.createElement('div'); line.className='summary-line';
    const label=document.createElement('span'); label.textContent=data.summary.groups.map(key=>row[key]||'Belum diisi').join(' · ');
    const value=document.createElement('strong'); value.textContent=numberID.format(row.count)+' catatan'+(row.value==null?'':' · '+numberID.format(row.value)+' '+data.summary.unit);
    line.append(label,value); box.append(line);
  }
  if(data.summary?.truncated){const warning=document.createElement('p');warning.textContent='Menampilkan 300 kelompok pertama.';box.append(warning);}
  if(!data.summary?.rows?.length)box.textContent='Belum ada data.';
  element.append(title,info,box);
}
function showPackingSummary(element,data) {
  element.replaceChildren();
  const title=document.createElement('strong');title.textContent=`Ringkasan packing · ${numberID.format(data.total)} catatan`;
  const note=document.createElement('p');note.textContent='Jumlah box per kelas dan bentuk untuk seluruh catatan.';
  const groups=data.summary?.rows||[], forms=[...new Set(groups.map(r=>r.bentuk||'Belum diisi'))].sort((a,b)=>a.localeCompare(b,'id'));
  const classes=[...new Set(groups.map(r=>r.kelas||'Belum diisi'))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
  const wrap=document.createElement('div');wrap.className='matrix-scroll';const table=document.createElement('table');table.className='progress-matrix';
  const head=document.createElement('thead'),hr=document.createElement('tr');for(const label of ['Kelas',...forms,'Total box']){const th=document.createElement('th');th.textContent=label;hr.append(th);}head.append(hr);table.append(head);
  const body=document.createElement('tbody');for(const cls of classes){const tr=document.createElement('tr');tr.insertCell().textContent=cls;let total=0;for(const form of forms){const found=groups.filter(r=>(r.kelas||'Belum diisi')===cls&&(r.bentuk||'Belum diisi')===form);const value=found.reduce((n,r)=>n+Number(r.value||0),0);total+=value;tr.insertCell().textContent=found.length?numberID.format(value):'—';}tr.insertCell().textContent=numberID.format(total);body.append(tr);}table.append(body);wrap.append(table);element.append(title,note,wrap);
}
function phasesForBlock(catalog,name) {
  const key=String(name||'').trim().toLowerCase();
  const found=(catalog?.blocks||[]).filter(b=>[b.name,...(b.aliases||[])].some(n=>String(n||'').trim().toLowerCase()===key));
  if(found.length!==1)return [];
  const groups=found[0].groups||[];
  if(!groups.length||groups.some(g=>!g.cycle))return [];
  return [...new Set(groups.map(g=>g.cycle))];
}
function showSummaryTable(element,title,note,headers,rows) {
  element.replaceChildren();const heading=document.createElement('strong');heading.textContent=title;const p=document.createElement('p');p.textContent=note;
  const wrap=document.createElement('div');wrap.className='matrix-scroll';const table=document.createElement('table');table.className='progress-matrix';const head=document.createElement('thead'),tr=document.createElement('tr');for(const label of headers){const th=document.createElement('th');th.textContent=label;tr.append(th);}head.append(tr);table.append(head);const body=document.createElement('tbody');for(const row of rows){const line=document.createElement('tr');for(const value of row)line.insertCell().textContent=value==null?'—':String(value);body.append(line);}table.append(body);wrap.append(table);element.append(heading,p,wrap);
}
function showNurserySummary(element,data) {
  const rows=(data.summary?.rows||[]).map(r=>[r.klon||'Belum diisi',r.pertama===r.terakhir?(r.pertama||'—'):[r.pertama||'?',r.terakhir||'?'].join(' s.d. '),...['qty_datang','afkir','splitting','mortal','ditanam','saldo'].map(k=>numberID.format(r[k]||0))]);
  showSummaryTable(element,`Ringkasan bibit per varietas · ${numberID.format(data.total)} batch`,'Total seluruh batch; umur setiap batch ditampilkan pada rincian di bawah.',['Varietas','Tanggal datang','Datang','Afkir','Splitting','Mati','Ditanam','Saldo'],rows);
}
function showEstimateSummary(element,data) {
  const rows=(data.summary?.rows||[]).sort((a,b)=>String(b.tahun||'').localeCompare(String(a.tahun||''))).map(r=>[r.tahun||'Belum diisi',...['value','box_a','box_b','box_c'].map(k=>r[k]==null?'—':numberID.format(r[k]))]);
  showSummaryTable(element,`Ringkasan estimasi per tahun · ${numberID.format(data.total)} catatan`,'Jumlah box berdasarkan tahun target.',['Tahun','Total box','Kelas A','Kelas B','Kelas C'],rows);
}
function showRiceHarvestSummary(element,data,milling) {
  const rows=(data.summary?.rows||[]).sort((a,b)=>String(a.petak||'').localeCompare(String(b.petak||''),'id',{numeric:true})).map(r=>[r.petak||'Belum diisi',r.value==null?'—':numberID.format(r.value),r.gkg_kg==null?'Belum dicatat':numberID.format(r.gkg_kg)+(r.gkg_count<r.count?' (sebagian tercatat)':'')]);
  const total=milling&&!milling.summary?.truncated?(milling.summary?.rows||[]).reduce((n,r)=>n+Number(r.value||0),0):null;
  showSummaryTable(element,`Ringkasan panen Padi · ${numberID.format(data.total)} catatan`,'GKP dan GKG per blok. Beras masuk seluruh penggilingan: '+(total==null?'belum tersedia':numberID.format(total)+' kg')+'; beras tidak dibagi per blok karena sumber penggilingan belum terhubung secara pasti.',['Blok','GKP (kg)','GKG (kg)'],rows);
}
function nurseryAge(row) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.tanggal_datang||''))return 'Tanggal belum tersedia';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
  const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(row.tanggal_datang+'T00:00:00Z'))/86400000);
  if(!Number.isFinite(days)||days<0)return 'Tanggal belum tiba';
  const parts=n=>{const years=Math.floor(n/365.2425);n-=Math.round(years*365.2425);const months=Math.floor(Math.max(0,n)/30.436875);n-=Math.round(months*30.436875);return `${years} th ${months} bln ${Math.max(0,n)} hr`;};
  const elapsed=`Sejak datang ${days} hari (± ${parts(days)})`;
  if(row.umur_datang_bln==null||row.umur_datang_bln==='')return elapsed+' · umur awal belum diisi';
  return `Umur ± ${parts(days+Math.round(Number(row.umur_datang_bln)*30.436875))} · ${elapsed}`;
}
async function showClimateGraphs(element,month) {
  element.replaceChildren();const title=document.createElement('strong');title.textContent='Curah hujan dan suhu';
  const label=document.createElement('label');label.textContent='Pilih bulan';const picker=document.createElement('input');picker.type='month';picker.value=month;label.append(picker);element.append(title,label);
  const info=document.createElement('p');info.textContent='Hujan: nilai kumulatif terbesar setiap hari. Suhu: rata-rata sensor luar harian. Hari tanpa data tidak dianggap nol.';element.append(info);
  const graphs=document.createElement('div');element.append(graphs);
  picker.addEventListener('change',()=>{if(picker.value)showClimateGraphs(element,picker.value);});
  try {
    const [year,mo]=month.split('-').map(Number),end=new Date(Date.UTC(year,mo,0)).getUTCDate();
    const data=await request(`/api/climate?from=${month}-01&to=${month}-${String(end).padStart(2,'0')}`);if(!element.contains(graphs))return;
    const days=new Map(data.days.map(d=>[Number(d.tanggal.slice(-2)),d]));
    for(const [heading,key,unit] of [['Curah hujan','hujan','mm'],['Suhu luar rata-rata','tavg','°C']]){
      const h=document.createElement('h4');h.textContent=heading;graphs.append(h);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 680 160');svg.setAttribute('role','img');svg.setAttribute('aria-label',heading+' harian, '+month);svg.style.cssText='width:100%;min-width:500px;height:160px';
      const values=[...days.values()].map(d=>d[key]).filter(v=>v!=null&&Number.isFinite(Number(v))).map(Number);if(!values.length){const p=document.createElement('p');p.textContent='Belum ada data.';graphs.append(p);continue;}
      const min=key==='hujan'?0:Math.min(0,...values),max=Math.max(1,...values),range=max-min||1;let previous=null;
      for(let day=1;day<=end;day++){const v=days.get(day)?.[key];if(v==null||!Number.isFinite(Number(v))){previous=null;continue;}const x=35+(day-1)*620/Math.max(1,end-1),y=130-(Number(v)-min)/range*110;const el=document.createElementNS(svg.namespaceURI,key==='hujan'?'rect':'circle');if(key==='hujan'){el.setAttribute('x',x-5);el.setAttribute('y',y);el.setAttribute('width','10');el.setAttribute('height',130-y);}else{el.setAttribute('cx',x);el.setAttribute('cy',y);el.setAttribute('r','3');if(previous){const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,vv] of Object.entries({x1:previous.x,y1:previous.y,x2:x,y2:y,stroke:'#c67331','stroke-width':'2'}))line.setAttribute(k,vv);svg.append(line);}previous={x,y};}el.setAttribute('fill',key==='hujan'?'#4186b0':'#c67331');const tip=document.createElementNS(svg.namespaceURI,'title');tip.textContent=`${day} ${month}: ${numberID.format(v)} ${unit}`;el.append(tip);svg.append(el);}
      for(const [x,text] of [[35,'1'],[330,'15'],[650,String(end)]]){const label=document.createElementNS(svg.namespaceURI,'text');label.setAttribute('x',x);label.setAttribute('y','151');label.setAttribute('font-size','12');label.textContent=text;svg.append(label);}const scale=document.createElementNS(svg.namespaceURI,'text');scale.setAttribute('x','5');scale.setAttribute('y','15');scale.setAttribute('font-size','11');scale.textContent=numberID.format(max)+' '+unit;svg.append(scale);const scroll=document.createElement('div');scroll.style.overflowX='auto';scroll.append(svg);graphs.append(scroll);
    }
  }catch(error){graphs.textContent='Grafik belum dapat dimuat: '+error.message;}
}
function showBananaHarvestSummary(element,data,catalog) {
  element.replaceChildren();const title=document.createElement('strong');title.textContent=`Ringkasan panen Pisang · ${numberID.format(data.total)} catatan`;
  const note=document.createElement('p');note.textContent='Total panen seluruh catatan per blok. Fase adalah kondisi GIS saat ini, bukan fase seluruh riwayat panen.';
  const wrap=document.createElement('div');wrap.className='matrix-scroll';const table=document.createElement('table');table.className='progress-matrix';const head=document.createElement('thead'),hr=document.createElement('tr');for(const x of ['Blok','Fase GIS saat ini','Total panen (tandan / pokok)']){const th=document.createElement('th');th.textContent=x;hr.append(th);}head.append(hr);table.append(head);
  const body=document.createElement('tbody');for(const r of [...(data.summary?.rows||[])].sort((a,b)=>String(a.blok||'').localeCompare(String(b.blok||''),'id',{numeric:true}))){const tr=document.createElement('tr');tr.insertCell().textContent=r.blok||'Belum diisi';tr.insertCell().textContent=phasesForBlock(catalog,r.blok).join(' / ')||'Belum tersedia';tr.insertCell().textContent=r.value==null?'—':numberID.format(r.value);body.append(tr);}table.append(body);wrap.append(table);element.append(title,note,wrap);
}
let phaseRequest=0;
async function updateHarvestPhase() {
  if(get('harvest-type').value!=='pisang_panen_pkk')return;
  const form=get('harvest-entry'),phase=form.elements.fase,block=form.elements.blok.value,at=form.elements.tanggal.value,token=++phaseRequest;
  if(!block||!at){phase.value='';get('harvest-save').disabled=false;return;}
  phase.value='';
  get('harvest-save').disabled=true;
  try {const catalog=await request('/api/harvest-phases?at='+encodeURIComponent(at));if(token!==phaseRequest||!get('harvest-editor').open)return;const cycles=phasesForBlock(catalog,block);phase.value=cycles.length===1?cycles[0]:'';message(get('harvest-message'),cycles.length===1?'Fase mengikuti GIS pada tanggal panen.':cycles.length>1?'Blok memiliki beberapa fase. Pilih fase panen yang sesuai.':'Fase GIS belum tersedia. Pilih fase setelah memeriksa data tanam.');}
  catch(error){if(token===phaseRequest)message(get('harvest-message'),'Fase GIS belum dapat dimuat. Pilih fase setelah memeriksa data tanam.',true);}
  finally{if(token===phaseRequest&&get('harvest-editor').open)get('harvest-save').disabled=false;}
}
function showProgressMatrix(data, locations) {
  const host=get('progress-summary');host.replaceChildren();
  const title=document.createElement('strong');title.textContent=`Ringkasan progres admin · ${numberID.format(data.total)} catatan`;
  const note=document.createElement('p');note.textContent='Hektare dari input admin sesuai pencarian. Hijau: mencapai luas GIS. ↑ Baru: hasil terakhir disimpan di sesi ini. Laporan mandor dicatat di Daily.';
  const wrap=document.createElement('div');wrap.className='matrix-scroll';
  const table=document.createElement('table');table.className='progress-matrix';
  const stages=['Land Clearing','Bajak 1','Dolomite','Bajak 2','Stik Ridger','Ridger','Install Drip','Stik Tanam','Tanam'];
  const head=document.createElement('tr');for(const label of ['Blok','Luas GIS (ha)',...stages]){const th=document.createElement('th');th.textContent=label;head.append(th);}const thead=document.createElement('thead');thead.append(head);table.append(thead);
  const areas=new Map(locations.filter(x=>x.blok_id).map(x=>[String(x.nama).toLowerCase(),Number(x.luas_ha)])),blocks=new Map();
  for(const row of data.summary?.rows||[]){const name=String(row.blok||'Belum diisi'),stage=stages.find(x=>x.toLowerCase()===String(row.aktivitas||'').toLowerCase());if(!stage)continue;const key=name.toLowerCase();if(!blocks.has(key))blocks.set(key,{name,values:new Map()});blocks.get(key).values.set(stage,row.value);}
  const tbody=document.createElement('tbody');for(const [key,block] of [...blocks].sort((a,b)=>a[1].name.localeCompare(b[1].name,'id',{numeric:true}))){const tr=document.createElement('tr'),area=areas.get(key);let cell=tr.insertCell();cell.textContent=block.name;cell=tr.insertCell();cell.textContent=area>0?areaFormat.format(area):'—';
    for(const stage of stages){cell=tr.insertCell();const value=block.values.get(stage);cell.textContent=value==null?'—':areaFormat.format(value);if(value!=null&&area>0&&Number(value)>=area-0.000001){cell.classList.add('stage-full');cell.title='Mencapai luas GIS';}if(recentlySaved?.table==='lahan_harian'&&String(recentlySaved.blok||'').toLowerCase()===key&&recentlySaved.aktivitas===stage){cell.classList.add('stage-recent');cell.textContent+=' ↑';cell.title='Baru disimpan';}}
    tbody.append(tr);
  }
  table.append(tbody);wrap.append(table);host.append(title,note,wrap);if(!blocks.size){const empty=document.createElement('p');empty.textContent='Belum ada progres tahap Land Clearing sampai Tanam.';host.append(empty);}
}
const canUseTable = table => currentRoles.some(role => availableRoles[role]?.edit === '*' || (availableRoles[role]?.edit || []).includes(table));
const bananaTables = ['pisang_panen_pkk','pisang_box','pisang_bibit','pisang_estimasi','pisang_handclass'];
const riceTables = ['padi_panen','padi_giling','padi_benih','padi_rencana'];
const landPlanTables = ['lahan_target','lahan_rencana','lahan_aktivitas'];
const harvestFields = {
  lahan_aktivitas: [
    { key: 'untuk', label: 'Komoditas', options: ['Pisang', 'Padi', 'Semua'], required: true },
    { key: 'urutan', label: 'Urutan kegiatan', type: 'number', step: '1', required: true },
    { key: 'aktivitas', label: 'Nama kegiatan', type: 'text', required: true },
    { key: 'hari_per_ha', label: 'Hari kerja per hektare', type: 'number', step: 'any' },
    { key: 'tim', label: 'Jumlah tim', type: 'number', step: '1' },
    { key: 'libur', label: 'Hari libur', options: ['Minggu', 'Sabtu & Minggu'] },
    { key: 'rute', label: 'Urutan blok', options: ['Prioritas tanam', 'Blok terdekat'] },
    { key: 'alat', label: 'Alat dipakai bersama', type: 'text' },
  ],
  lahan_target: [
    { key: 'mulai_persiapan', label: 'Mulai persiapan paling awal', type: 'date' },
    { key: 'prioritas', label: 'Prioritas (angka lebih besar dikerjakan belakangan)', type: 'number', step: '1' },
  ],
  lahan_rencana: [
    { key: 'aktivitas', label: 'Aktivitas', ref: 'activities', required: true },
    { key: 'luas_ha', label: 'Luas rencana (ha)', type: 'number', step: 'any', required: true },
    { key: 'selesai', label: 'Tanggal selesai', type: 'date', required: true },
    { key: 'urutan', label: 'Prioritas blok', type: 'number', step: '1' },
  ],
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
  if(recentlySaved?.table==='lahan_harian'&&recentlySaved.id===row.id)tr.classList.add('recent-row');
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
    action.append(deleteButton('lahan_harian', row, refresh));
  }
  return tr;
}

function deleteButton(table, row, reload) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'secondary'; button.textContent = 'Hapus';
  button.addEventListener('click', async () => {
    if (!confirm('Hapus satu catatan ini? Penghapusan mengubah angka laporan yang terkait.')) return;
    button.disabled = true;
    try {
      await request('/api/t/' + table + '/' + row.id + '?updated_at=' + encodeURIComponent(row.updated_at || ''), 'DELETE');
      message(status, 'Catatan dihapus.');
      await reload();
    } catch (error) { message(status, error.message, true); button.disabled = false; }
  });
  return button;
}

async function refresh() {
  const current = Symbol();
  pageRequest = current;
  const params = new URLSearchParams({ limit: pageSize, offset, sort: '-tanggal', q: search.elements.q.value.trim(), summary:'1' });
  try {
    const [data,locations] = await Promise.all([request('/api/records/lahan_harian?' + params),request('/api/daily/locations').catch(()=>[])]);
    if (current !== pageRequest) return;
    if (!params.get('q')) get('progress-count').textContent = `${new Intl.NumberFormat('id-ID').format(data.total)} catatan`;
    get('rows').replaceChildren(...data.rows.map(renderRow));
    showProgressMatrix(data,locations);
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
  updatePlantCountVisibility();
  get('edit-title').textContent = row ? 'Revisi progres harian' : 'Tambah progres harian';
  message(get('edit-message'), 'Memuat pilihan…');
  get('save').disabled = true;
  editor.showModal();
  const editorRow = row;
  try {
    const [activities, locations] = await Promise.all([request('/api/t/lahan_aktivitas'), request('/api/daily/locations')]);
    if (!editor.open || editing !== editorRow) return;
    progressLocations = locations;
    setOptions(entry.elements.aktivitas, activities.map(a => a.aktivitas).filter(Boolean), row?.aktivitas);
    setOptions(entry.elements.blok, locations.filter(b => b.blok_id).map(b => b.nama), row?.blok);
    updatePlantCountVisibility();
    entry.elements.tanggal.value = row?.tanggal ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    entry.elements.hasil_ha.value = row?.hasil_input_ha ?? row?.hasil_ha ?? '';
    entry.elements.keterangan.value = row?.keterangan ?? '';
    message(get('edit-message'), '');
    get('save').disabled = false;
  } catch (error) {
    message(get('edit-message'), error.message, true);
  }
}

function updatePlantCountVisibility() {
  if (convertedArea !== null) entry.elements.hasil_ha.value = '';
  const location = progressLocations.find(b => b.nama === entry.elements.blok.value);
  const visible = String(location?.divisi || '').trim().toLowerCase() === 'pisang' && ['tanam', 'stik tanam'].includes(entry.elements.aktivitas.value.trim().toLowerCase());
  get('plant-count-label').hidden = !visible;
  get('plant-count').value = '';
  get('plant-count').setCustomValidity('');
  convertedArea = null;
}
entry.elements.aktivitas.addEventListener('change', updatePlantCountVisibility);
entry.elements.blok.addEventListener('change', updatePlantCountVisibility);
get('plant-count').addEventListener('input', event => {
  const input = event.currentTarget;
  const count = input.value === '' ? null : Number(input.value);
  const valid = count === null || (Number.isSafeInteger(count) && count >= 0);
  input.setCustomValidity(valid ? '' : 'Jumlah pokok harus berupa bilangan bulat tidak negatif.');
  convertedArea = count === null || !valid ? null : count / 2000;
  entry.elements.hasil_ha.value = convertedArea === null ? '' : String(Math.round(count / 2) / 1000);
});
entry.elements.hasil_ha.addEventListener('input', () => {
  get('plant-count').value = '';
  get('plant-count').setCustomValidity('');
  convertedArea = null;
});

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
  get('open-land-plans').hidden = !landPlanTables.some(canUseTable);
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
  const sort = table === 'lahan_aktivitas' ? 'urutan' : table === 'pisang_bibit' ? '-tanggal_datang' : ['pisang_estimasi','lahan_target'].includes(table) ? '-bulan' : ['padi_rencana','lahan_rencana'].includes(table) ? '-mulai' : '-tanggal';
  const params = new URLSearchParams({ limit: pageSize, offset: harvestOffset, sort, summary:'1' });
  try {
    const [data,catalog,milling] = await Promise.all([request('/api/records/' + table + '?' + params),table==='pisang_panen_pkk'?request('/api/harvest-phases').catch(()=>null):Promise.resolve(null),table==='padi_panen'?request('/api/records/padi_giling?limit=1&summary=1').catch(()=>null):Promise.resolve(null)]);
    if (harvestRequest !== token) return;
    const headings = [...(table==='lahan_aktivitas'?[]:[table === 'pisang_bibit' ? 'Tanggal datang' : ['pisang_estimasi','lahan_target'].includes(table) ? 'Bulan target' : table === 'padi_rencana' ? 'Minggu mulai' : table === 'lahan_rencana' ? 'Mulai' : 'Tanggal']), ...(['lahan_aktivitas', 'pisang_bibit', 'pisang_estimasi', 'padi_giling', 'padi_benih', 'iklim', 'pisang_penjualan'].includes(table) ? [] : [table.startsWith('padi_') ? 'Petak' : 'Blok']), ...harvestFields[table].map(field => field.label), ...(table === 'padi_benih' ? ['Saldo varietas saat ini (kg)'] : table === 'pisang_bibit' ? ['Umur saat ini / lama sejak datang','Saldo batch (pokok)'] : table.endsWith('_penjualan') ? ['Total (Rp)'] : []), 'Keterangan', 'Aksi'];
    const header = document.createElement('tr');
    for (const label of headings) {
      const th = document.createElement('th');
      th.textContent = label;
      header.append(th);
    }
    get('harvest-head').replaceChildren(header);
    const rows = data.rows.map(row => {
      const tr = document.createElement('tr');
      if(recentlySaved?.table===table&&recentlySaved.id===row.id)tr.classList.add('recent-row');
      const date = table === 'pisang_bibit' ? row.tanggal_datang : ['pisang_estimasi','lahan_target'].includes(table) ? row.bulan : ['padi_rencana','lahan_rencana'].includes(table) ? row.mulai : row.tanggal;
      for (const value of [...(table==='lahan_aktivitas'?[]:[date]), ...(['lahan_aktivitas', 'pisang_bibit', 'pisang_estimasi', 'padi_giling', 'padi_benih', 'iklim', 'pisang_penjualan'].includes(table) ? [] : [table.startsWith('padi_') ? row.petak : row.blok]), ...harvestFields[table].map(field => row[field.key]), ...(table === 'padi_benih' ? [row.saldo_varietas] : table === 'pisang_bibit' ? [nurseryAge(row),row.saldo] : table.endsWith('_penjualan') ? [row.total] : []), row.keterangan]) {
        tr.insertCell().textContent = value ?? '—';
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Revisi';
      button.addEventListener('click', () => openHarvestEditor(row));
      const action = tr.insertCell(); action.append(button, deleteButton(table, row, refreshHarvest));
      return tr;
    });
    get('harvest-rows').replaceChildren(...rows);
    if(table==='pisang_box')showPackingSummary(get('harvest-summary'),data);else if(table==='pisang_panen_pkk')showBananaHarvestSummary(get('harvest-summary'),data,catalog);else if(table==='pisang_bibit')showNurserySummary(get('harvest-summary'),data);else if(table==='pisang_estimasi')showEstimateSummary(get('harvest-summary'),data);else if(table==='padi_panen')showRiceHarvestSummary(get('harvest-summary'),data,milling);else if(table==='iklim')showClimateGraphs(get('harvest-summary'),new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date()).slice(0,7));else showInputSummary(get('harvest-summary'),data);
    get('harvest-range').textContent = data.total ? `${data.offset + 1}–${data.offset + data.rows.length} dari ${data.total}` : 'Belum ada data';
    get('harvest-prev').disabled = data.offset === 0;
    get('harvest-next').disabled = data.offset + data.rows.length >= data.total;
  } catch (error) {
    if (harvestRequest === token) message(status, error.message, true);
  }
}

async function openHarvestEditor(row = null) {
  phaseRequest++;
  const form = get('harvest-entry');
  const table = get('harvest-type').value;
  harvestEditing = row;
  form.reset();
  salesWarningSignature = null;
  get('sales-warning').hidden = true;
  get('sales-warning-confirm').checked = false;
  const title = table === 'lahan_target' ? 'target tanam' : table === 'lahan_rencana' ? 'rencana kerja' : table === 'padi_rencana' ? 'rencana mingguan Padi' : table === 'pisang_penjualan' ? 'penjualan Pisang' : table === 'padi_penjualan' ? 'penjualan Padi' : table === 'pisang_handclass' ? 'Hand Class Pisang' : table === 'pisang_estimasi' ? 'estimasi panen Pisang' : table === 'pisang_bibit' ? 'batch bibit Pisang' : table === 'iklim' ? 'data iklim' : table === 'padi_benih' ? 'mutasi benih Padi' : table === 'padi_giling' ? 'penggilingan' : table === 'pisang_box' ? 'packing' : table === 'padi_panen' ? 'panen Padi' : 'panen';
  get('harvest-title').textContent = (row ? 'Revisi ' : 'Tambah ') + (table==='lahan_aktivitas'?'urutan aktivitas':title);
  const dateValue = table === 'pisang_bibit' ? row?.tanggal_datang : ['pisang_estimasi','lahan_target'].includes(table) ? row?.bulan : ['padi_rencana','lahan_rencana'].includes(table) ? row?.mulai : row?.tanggal;
  form.elements.tanggal.value = row ? dateValue ?? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  get('harvest-date-label').textContent = ['pisang_estimasi','lahan_target'].includes(table) ? 'Bulan target (pilih tanggal dalam bulan)' : table === 'padi_rencana' ? 'Minggu mulai' : table === 'lahan_rencana' ? 'Tanggal mulai' : 'Tanggal';
  get('harvest-date-container').hidden = table==='lahan_aktivitas';
  form.elements.tanggal.disabled = table==='lahan_aktivitas';
  form.elements.tanggal.required = table!=='lahan_aktivitas' && !(table === 'padi_panen' && row && !row.tanggal);
  form.elements.keterangan.value = row?.keterangan ?? '';
  form.elements.blok.required = (landPlanTables.includes(table)&&table!=='lahan_aktivitas') || table === 'pisang_panen_pkk' || table === 'pisang_handclass' || table === 'padi_panen';
  get('harvest-block-caption').textContent = table.startsWith('padi_') ? 'Petak' : 'Blok';
  const skipBlock = ['lahan_aktivitas', 'pisang_bibit', 'pisang_estimasi', 'padi_giling', 'padi_benih', 'iklim', 'pisang_penjualan'].includes(table) || (table === 'padi_penjualan' && !currentIsAdmin);
  get('harvest-block-label').hidden = skipBlock;
  form.elements.blok.disabled = skipBlock;
  const fields = harvestFields[table].map(field => {
    const label = document.createElement('label');
    label.append(document.createTextNode(field.label));
    const input = document.createElement(field.options || field.ref ? 'select' : 'input');
    input.name = field.key;
    input.required = Boolean(field.required);
    if(table==='lahan_aktivitas'&&field.key==='aktivitas'&&row){input.readOnly=true;input.title='Nama kegiatan lama dipertahankan untuk riwayat.';}
    if(table==='lahan_aktivitas'&&field.key==='untuk'&&row){input.disabled=true;input.title='Komoditas kegiatan lama dipertahankan untuk riwayat.';}
    if (field.options) setOptions(input, field.options, row?.[field.key]);
    else if (field.ref) setOptions(input, [], row?.[field.key]);
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
  if(table==='pisang_panen_pkk')form.elements.fase.required=!row;
  message(get('harvest-message'), 'Memuat blok…');
  get('harvest-save').disabled = true;
  get('harvest-editor').showModal();
  if (skipBlock) {
    message(get('harvest-message'), '');
    get('harvest-save').disabled = false;
    return;
  }
  try {
    const [locations, activities] = await Promise.all([request('/api/daily/locations'), table === 'lahan_rencana' ? request('/api/t/lahan_aktivitas') : Promise.resolve([])]);
    if (!get('harvest-editor').open) return;
    const division = table.startsWith('padi_') ? 'Padi' : 'Pisang';
    setOptions(form.elements.blok, locations.filter(b => b.blok_id && (landPlanTables.includes(table) || b.divisi === division)).map(b => b.nama), table.startsWith('padi_') ? row?.petak : row?.blok);
    if (table === 'lahan_rencana') setOptions(form.elements.aktivitas, activities.map(a => a.aktivitas).filter(Boolean), row?.aktivitas);
    message(get('harvest-message'), '');
    get('harvest-save').disabled = false;
  } catch (error) {
    message(get('harvest-message'), error.message, true);
  }
}

get('harvest-entry').elements.blok.addEventListener('change',updateHarvestPhase);
get('harvest-entry').elements.tanggal.addEventListener('change',updateHarvestPhase);

get('open-land-plans').addEventListener('click', () => {
  dashboard.hidden = true;
  get('harvest').hidden = false;
  get('harvest-section-title').textContent = 'Target Tanam & Rencana Kerja';
  get('harvest-description').textContent = 'Atur target bulan tanam dan jadwal per blok. Blok dikelola melalui Peta Kebun.';
  get('harvest-type-label').hidden = false;
  for (const option of get('harvest-type').options) option.hidden = !landPlanTables.includes(option.value) || !canUseTable(option.value);
  get('harvest-type').value = landPlanTables.find(canUseTable);
  harvestOffset = 0;
  refreshHarvest();
});
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
  if (['pisang_estimasi','lahan_target'].includes(table)) {
    data.bulan = data.tanggal;
    delete data.tanggal;
  }
  if (['padi_panen', 'padi_penjualan', 'padi_rencana'].includes(table)) {
    if ('blok' in data) data.petak = data.blok;
    delete data.blok;
  }
  if (['padi_rencana','lahan_rencana'].includes(table)) {
    data.mulai = data.tanggal;
    delete data.tanggal;
    if (data.selesai < data.mulai) {
      message(get('harvest-message'), 'Tanggal selesai tidak boleh sebelum tanggal mulai.', true);
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
    const result=harvestEditing ? await request('/api/t/' + table + '/' + harvestEditing.id, 'PUT', { ...data, updated_at: harvestEditing.updated_at ?? null }) : await request('/api/t/' + table, 'POST', data);
    recentlySaved={table,id:harvestEditing?.id??result.id};
    get('harvest-editor').close();
    if(!harvestEditing)harvestOffset = 0;
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
  data.hasil_ha = convertedArea ?? Number(data.hasil_ha);
  const row = editing;
  try {
    const result = row ? await request(tablePath + '/' + row.id, 'PUT', { ...data, updated_at: row.updated_at ?? null }) : await request(tablePath, 'POST', data);
    recentlySaved={table:'lahan_harian',id:row?.id??result.id,blok:data.blok,aktivitas:data.aktivitas};
    editor.close();
    message(status, 'Progres tersimpan. Muat ulang daftar…');
    if(!row){offset = 0;search.reset();}
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
