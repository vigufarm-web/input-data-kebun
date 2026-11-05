import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};this.namespaceURI='svg';this.textContent='';}
 append(...children){this.children.push(...children);}
 replaceChildren(){this.children=[];}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(){}
 contains(node){return this===node||this.children.some(x=>x.contains?.(node));}
}
test('one chart draws rainfall and temperature, preserving zero and gaps',async()=>{
 const code=await fs.readFile(new URL('./app.js',import.meta.url),'utf8');const start=code.indexOf('async function showClimateGraphs('),end=code.indexOf('function showBananaHarvestSummary(',start);assert.ok(start>=0&&end>start);
 const document={createElement:t=>new Element(t),createElementNS:(_ns,t)=>new Element(t)};
 const data={days:[{tanggal:'2026-11-01',hujan:0,tavg:26},{tanggal:'2026-11-02',hujan:5,tavg:null},{tanggal:'2026-11-03',hujan:null,tavg:28}]};
 const context=vm.createContext({document,Intl,Date,Number,Math,request:async()=>data,numberID:new Intl.NumberFormat('id-ID')});
 vm.runInContext(code.slice(start,end),context);const root=new Element('div');await context.showClimateGraphs(root,'2026-11');
 const all=[];const visit=x=>{all.push(x);for(const y of x.children||[])visit(y);};visit(root);
 assert.equal(all.filter(x=>x.tag==='svg').length,1);assert.equal(all.filter(x=>x.tag==='rect').length,2);assert.equal(all.filter(x=>x.tag==='circle').length,2);assert.equal(all.filter(x=>x.tag==='line').length,0,'temperature line must not cross missing days');
 assert.match(all.find(x=>x.tag==='svg').attributes['aria-label'],/gabungan/);
});
