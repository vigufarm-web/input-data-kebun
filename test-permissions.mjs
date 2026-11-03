import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import ExcelJS from './.demo-backend/lib/exceljs.min.cjs';

const probe=createServer();
probe.listen(0,'127.0.0.1');
await once(probe,'listening');
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const password=crypto.randomUUID();
const proc=spawn(process.execPath,['start-demo.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DEMO_PASSWORD:password},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='',cookie='';
for(const stream of [proc.stdout,proc.stderr])stream.on('data',b=>logs+=b);
const base='http://127.0.0.1:'+port;
async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});
 if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 return r;
}
try{
 for(let i=0;i<100;i++){
  if(proc.exitCode!==null)throw Error(logs);
  try{if((await call('/api/me')).ok)break;}catch{}
  if(i===99)throw Error(logs);
  await new Promise(r=>setTimeout(r,250));
 }
 assert.match(await (await call('/')).text(),/Lingkungan uji/);
 assert.equal((await call('/api/records/lahan_harian')).status,401);
 const login=await call('/api/login','POST',{username:'admin-demo',password});
 assert.equal(login.status,200,await login.clone().text());
 assert.match(login.headers.get('set-cookie'),/HttpOnly/i);
 assert.equal((await (await call('/api/me')).json()).online,false);
 assert.equal((await (await call('/api/records/lahan_harian')).json()).total,0);
 const locations=await (await call('/api/daily/locations')).json();
 assert.deepEqual(locations.filter(x=>x.blok_id).map(x=>x.nama).sort(),['UJI-01','UJI-PADI']);
 const entry={tanggal:'2026-11-03',blok:'UJI-01',aktivitas:'Tanam',hasil_ha:.15,keterangan:'Verifikasi demo'};
 const created=await call('/api/t/lahan_harian','POST',entry);assert.equal(created.status,200,await created.clone().text());
 const {id}=await created.json();
 const list=async()=>(await (await call('/api/records/lahan_harian')).json()).rows.find(r=>r.id===id);
 const first=await list();assert.equal(first.hasil_ha,.15);
 const change={...entry,hasil_ha:.18,updated_at:first.updated_at};
 assert.equal((await call('/api/t/lahan_harian/'+id,'PUT',change)).status,200);
 assert.equal((await call('/api/t/lahan_harian/'+id,'PUT',change)).status,409);
 assert.equal((await list()).hasil_ha,.18);
 const downloaded=await call('/api/excel/download?tables=lahan_harian');assert.equal(downloaded.status,200);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await downloaded.arrayBuffer()));
 const row=workbook.getWorksheet('Progres - Harian').getRow(2).values;
 assert.ok(row.includes('UJI-01')&&row.includes(.18));
 for (const [table, sample] of [
  ['padi_rencana',{mulai:'2026-11-02',selesai:'2026-11-08',minggu_ke:1,pekerjaan:'Olah lahan',aktivitas:'Tanam uji',petak:'UJI-PADI',rencana:4,satuan:'ha',realisasi:2}],
  ['pisang_penjualan',{tanggal:'2026-11-03',no_sj:'UJI-PISANG-1',pembeli:'Pembeli uji',tipe:'Penjualan',jenis_barang:'PISANG CAVENDISH FH A MATANG',jumlah_box:4,harga:10000,dibayar:5000}],
  ['padi_penjualan',{tanggal:'2026-11-03',petak:'UJI-PADI',no_sj:'UJI-PADI-1',pembeli:'Pembeli uji',tipe:'Penjualan',jenis:'Beras',berat_kg:25,harga_kg:12000,dibayar:50000}],
  ['pisang_panen_pkk',{tanggal:'2026-11-03',blok:'UJI-01',fase:'PC',pkk_panen:10}],
  ['pisang_box',{tanggal:'2026-11-03',kelas:'A',bentuk:'FH',jumlah_box:4,berat_kg:60}],
  ['padi_giling',{tanggal:'2026-11-03',gudang:'Uji',beras_kg:75,gabah_kg:100,sumber_panen:'Uji',tempat_giling:'Uji'}],
  ['padi_panen',{tanggal:'2026-11-03',petak:'UJI-PADI',gkp_kg:100,gkg_kg:75,gkg_basis:'Aktual',musim_tanam:'Arsip MT1',detail_timbang:'50;50',jumlah_karung:2}],
  ['iklim',{tanggal:'2099-10-20',jam:'14:00',hujan_mm:10,suhu_luar:-1,lembap_luar:80}],
  ['padi_benih',{tanggal:'2099-10-20',varietas:'Inpari 32',jenis:'Masuk',qty_kg:25}],
  ['pisang_bibit',{tanggal_datang:'2099-10-20',batch:'Uji',qty_datang:1000,afkir:10,splitting:20,mortal:30,ditanam:400}],
  ['pisang_estimasi',{bulan:'2099-10-01',box:100,box_a:60,box_b:30,box_c:10}],
  ['pisang_handclass',{tanggal:'2099-10-20',blok:'UJI-01',status:'PC',rata_hand:6.5,jumlah_sampel:12}],
 ]) {
  const create=await call('/api/t/'+table,'POST',sample);
  assert.equal(create.status,200,await create.clone().text());
  const id=(await create.json()).id;
  const rows=(await (await call('/api/records/'+table)).json()).rows;
  const old=rows.find(row=>row.id===id);
  assert.ok(old);
  if(table==='pisang_penjualan'){assert.equal(old.total,40000);assert.equal(old.dibayar,5000);assert.equal(old.kelas,'A');}
  if(table==='padi_penjualan'){assert.equal(old.total,300000);assert.equal(old.dibayar,50000);}
  const revision={...sample,keterangan:'revisi uji',updated_at:old.updated_at};
  assert.equal((await call('/api/t/'+table+'/'+id,'PUT',revision)).status,200);
  assert.equal((await call('/api/t/'+table+'/'+id,'PUT',revision)).status,409);
  const workbookResponse=await call('/api/excel/download?tables='+table);
  assert.equal(workbookResponse.status,200);
  const bytes=Buffer.from(await workbookResponse.arrayBuffer());
  assert.equal(bytes.subarray(0,2).toString(),'PK');
  if(table.endsWith('_penjualan')){
   const w=new ExcelJS.Workbook();await w.xlsx.load(bytes);
   const sheet=w.getWorksheet(table==='pisang_penjualan'?'Pisang - Penjualan':'Padi - Penjualan Beras');
   const headers=sheet.getRow(1).values, row=sheet.getRow(2).values;
   assert.equal(row[headers.indexOf('Nominal (Rp)')]?.result ?? row[headers.indexOf('Nominal (Rp)')],table==='pisang_penjualan'?40000:300000);
   assert.equal(row[headers.indexOf('Sudah Dibayar (Rp)')],table==='pisang_penjualan'?5000:50000);
  }
 }
 for(let i=0;i<205;i++){
  const added=await call('/api/t/padi_rencana','POST',{mulai:'2026-11-02',selesai:'2026-11-08',aktivitas:'Uji '+i});
  assert.equal(added.status,200,await added.clone().text());
 }
 const later=(await (await call('/api/records/padi_rencana?limit=100&offset=200')).json());
 assert.equal(later.total,206); assert.equal(later.rows.length,6);
 const useSeed=await call('/api/t/padi_benih','POST',{tanggal:'2099-10-21',varietas:'Inpari 32',jenis:'Pakai',qty_kg:7});
 assert.equal(useSeed.status,200,await useSeed.clone().text());
 const seedRows=(await (await call('/api/records/padi_benih')).json()).rows;
 assert.ok(seedRows.every(row=>row.saldo_varietas===18),'stock includes incoming and outgoing'); const seedlings=(await (await call('/api/records/pisang_bibit')).json()).rows;
 assert.equal(seedlings.find(row=>row.batch==='Uji').saldo,580);
 const riceOld=(await (await call('/api/records/padi_panen')).json()).rows[0];
 assert.equal(riceOld.gkg_basis,'Aktual');
 const riceEdit=await call('/api/t/padi_panen/'+riceOld.id,'PUT',{tanggal:riceOld.tanggal,petak:riceOld.petak,gkp_kg:110,gkg_kg:riceOld.gkg_kg,keterangan:'Uji revisi',updated_at:riceOld.updated_at});
 assert.equal(riceEdit.status,200,await riceEdit.clone().text());
 const riceAfter=(await (await call('/api/records/padi_panen')).json()).rows.find(row=>row.id===riceOld.id);
 assert.equal(riceAfter.gkg_basis,'Aktual');
 assert.equal(riceAfter.musim_tanam,'Arsip MT1');
 assert.equal(riceAfter.detail_timbang,'50;50');
 assert.equal(riceAfter.gkp_kg,110); const userpass=crypto.randomUUID();
 const userCreate=await call('/api/users','POST',{username:'mandor-uji',nama:'Mandor Uji',password:userpass,peran:['daily_pisang']});
 assert.equal(userCreate.status,200,await userCreate.clone().text());
 const userId=(await userCreate.json()).id;
 assert.equal((await call('/api/users/'+userId,'PUT',{nama:'Mandor Revisi',peran:['daily_padi'],aktif:1})).status,200);
 const users=await (await call('/api/users')).json();
 assert.equal(users.find(u=>u.id===userId).nama,'Mandor Revisi');
 assert.deepEqual(users.find(u=>u.id===userId).peran,['daily_padi']);
 const mixedpass=crypto.randomUUID();
 const mixed=await call('/api/users','POST',{username:'mandor-mixed-uji',nama:'Mandor Campuran Uji',password:mixedpass,peran:['daily_padi','penjualan']});
 assert.equal(mixed.status,200,await mixed.clone().text());
 const adminBeforeMixed=cookie;
 assert.equal((await call('/api/login','POST',{username:'mandor-mixed-uji',password:mixedpass})).status,200);
 assert.equal((await call('/api/records/pisang_penjualan')).status,403);
 assert.equal((await call('/api/excel/download?tables=pisang_penjualan')).status,403);
 assert.equal((await call('/api/t/padi_penjualan','POST',{tanggal:'2026-11-03',berat_kg:1})).status,403);
 cookie=adminBeforeMixed;
 const salespass=crypto.randomUUID();
 const salesUser=await call('/api/users','POST',{username:'sales-uji',nama:'Penjualan Uji',password:salespass,peran:['penjualan']});
 assert.equal(salesUser.status,200,await salesUser.clone().text());
 const adminCookie=cookie;
 assert.equal((await call('/api/login','POST',{username:'sales-uji',password:salespass})).status,200);
 for(const table of ['pisang_penjualan','padi_penjualan']){
  assert.equal((await call('/api/records/'+table)).status,200);
  assert.equal((await call('/api/excel/download?tables='+table)).status,200);
 }
 assert.equal((await call('/api/records/lahan_harian')).status,403);
 assert.equal((await call('/api/users')).status,403);
 assert.equal((await call('/api/t/pisang_bibit','POST',{tanggal_datang:'2026-11-03',qty_datang:10})).status,403);
 const prior=(await (await call('/api/records/padi_penjualan')).json()).rows.find(r=>r.no_sj==='UJI-PADI-1');
 assert.equal(prior.petak,'UJI-PADI');
 assert.equal((await call('/api/t/padi_penjualan/'+prior.id,'PUT',{dibayar:60000,updated_at:prior.updated_at})).status,200);
 assert.equal((await (await call('/api/records/padi_penjualan')).json()).rows.find(r=>r.id===prior.id).petak,'UJI-PADI');
 const sale=await call('/api/t/padi_penjualan','POST',{tanggal:'2026-11-03',no_sj:'SALES-UJI',berat_kg:20,harga_kg:5000});
 assert.equal(sale.status,200,await sale.clone().text());
 const saleId=(await sale.json()).id;
 const saleRow=(await (await call('/api/records/padi_penjualan')).json()).rows.find(r=>r.id===saleId);
 const edit=await call('/api/t/padi_penjualan/'+saleId,'PUT',{dibayar:10000,updated_at:saleRow.updated_at});
 assert.equal(edit.status,200,await edit.clone().text());
 cookie=adminCookie;
 assert.equal((await call('/api/login','POST',{username:'mandor-uji',password:userpass})).status,200);
 assert.equal((await call('/api/users')).status,403);
 assert.equal((await call('/api/records/pisang_penjualan')).status,403);
 assert.equal((await call('/api/excel/download?tables=pisang_penjualan')).status,403);
 assert.equal((await call('/api/t/padi_penjualan','POST',{tanggal:'2026-11-03',berat_kg:1})).status,403);
 assert.equal((await call('/api/users','POST',{username:'blocked',password:userpass,peran:['admin']})).status,403);
 cookie=adminCookie; assert.equal((await call('/api/logout','POST')).status,200);
 assert.equal((await call('/api/records/lahan_harian')).status,401);
 console.log('Demo Render terverifikasi secara lokal: database kosong, blok UJI-01, login, tambah, revisi, konflik versi, Excel sesuai, logout.');
}finally{
 if(proc.exitCode===null){
  if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true});
  else proc.kill('SIGTERM');
 }
}
