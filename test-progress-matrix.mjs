import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const fn=src.slice(src.indexOf('function showProgressMatrix('),src.indexOf('\nconst canUseTable',src.indexOf('function showProgressMatrix(')));
class Element { constructor(tag){this.tag=tag;this.children=[];this.classList={add(){}};} append(...v){this.children.push(...v)} replaceChildren(...v){this.children=v} insertCell(){let c=new Element('td');this.children.push(c);return c;} }
const host=new Element('div');const context={get:()=>host,document:{createElement:t=>new Element(t)},numberID:new Intl.NumberFormat('id-ID'),areaFormat:new Intl.NumberFormat('id-ID'),recentlySaved:null};runInNewContext(fn,context);
const locations=[{blok_id:'1',nama:'E08',divisi:'Pisang',luas_ha:.52},{blok_id:'2',nama:'E07',divisi:'Pisang',luas_ha:.97},{blok_id:'3',nama:'P01',divisi:'Padi',luas_ha:1},{nama:'Nursery',divisi:'Pisang'}];
const data={total:1,summary:{rows:[{blok:'E07',aktivitas:'Tanam',value:.2},{blok:'D14',aktivitas:'Bajak 1',value:.3}]}};
function rows(){return host.children[2].children[0].children[1].children.map(tr=>tr.children.map(c=>c.textContent));}
context.showProgressMatrix(data,locations);let out=rows();assert.deepEqual(out.map(x=>x[0]),['D14','E07','E08']);assert.equal(out[2][1],'0,52');assert.equal(out[2][2],'—');assert.equal(out[1].at(-1),'0,2');
context.showProgressMatrix({total:0,summary:{rows:[]}},locations,'E08');out=rows();assert.deepEqual(out.map(x=>x[0]),['E08']);
context.showProgressMatrix({total:0,summary:{rows:[]}},locations,'tidakada');assert.equal(rows().length,0);
console.log('OK: blok GIS tanpa progres, filter, catatan lama, dan divisi Padi');
