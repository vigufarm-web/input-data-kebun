import { readFile, writeFile } from 'node:fs/promises';

// Patch hanya untuk backend uji dengan revisi yang dipatok di prepare-demo.sh.
const path = process.argv[2] || '.demo-backend/server.js';
const source = await readFile(path, 'utf8');
const before = "  if(user&&!isAdmin(user)&&['t','tables','records','excel','blocks','gis','kebun'].includes(parts[1])&&!(parts[1]==='excel'&&editableExcelTables(user).length))return send(res,403,{error:'Rincian input hanya dapat dilihat admin. Ringkasan tetap tersedia.'});";
const after = `  const demoMandor = user && !isAdmin(user) && (user.peran || []).some(r => r.startsWith('daily_'));
  const demoSales = user && !isAdmin(user) && !demoMandor && (user.peran || []).includes('penjualan');
  const demoSalesTable = ['pisang_penjualan','padi_penjualan'].includes(parts[2]);
  if(demoMandor && parts[1] === 'excel') return send(res,403,{error:'Akun mandor tidak dapat mengunduh data penjualan.'});
  if(user&&!isAdmin(user)&&['t','tables','records','excel','blocks','gis','kebun'].includes(parts[1])&&!(parts[1]==='excel'&&editableExcelTables(user).length)&&!(demoSales&&demoSalesTable&&['records','t'].includes(parts[1])))return send(res,403,{error:'Rincian input hanya dapat dilihat sesuai hak akses.'});`;
if (source.includes(after)) process.exit(0);
if (source.split(before).length !== 2) throw new Error('Pola izin API uji berubah; patch dibatalkan.');
await writeFile(path, source.replace(before, after));
