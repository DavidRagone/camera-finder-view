'use strict';
/* Run with: node --test tests/*.test.js */
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {load,ROOT}=require('./load');

/* f/5.6 at 1/125 in EV 12 light is on the meter at ISO 400; each step of ev is one stop */
const BASE={lens:50,u:.25,Ni:4,Ti:7,ev:12,auto:false,dof:false,film:false,ax:0,ay:45};
const BESSAS=['voigtlander-bessa-r','voigtlander-bessa-r2'];
const frameHalfWidth=(c,f)=>1000*18/f*c.mag*c.fcov;
/* the readouts are the last thing a rangefinder draws, in their own scaled group */
const readout=(lib,id,st)=>lib.renderFinder(lib.CAM[id],'t-',{...BASE,...st}).inner.split(`<g transform="scale(${lib.DS})">`)[1];
function leds(lib,id,ev){ const s=readout(lib,id,{ev}), fill=re=>(s.match(re)||[])[1], on=c=>c===undefined?undefined:c===lib.LED;
  return {under:on(fill(/<path d="M-[^"]*" fill="([^"]+)"/)), dot:on(fill(/<circle cx="0" [^>]*r="4\.2" fill="([^"]+)"/)), over:on(fill(/<path d="M\d[^"]*" fill="([^"]+)"/))}; }

test('catalog entries are well formed', ()=>{
  const {CAMERAS,CAM,D}=load();
  assert.equal(Object.keys(CAM).length,CAMERAS.length,'camera ids must be unique');
  for(const c of CAMERAS){
    assert.match(c.id,/^[a-z0-9-]+$/);
    for(const k of ['make','model','years','note']) assert.ok(typeof c[k]==='string'&&c[k],`${c.id}: ${k}`);
    assert.ok(Number.isInteger(c.year),`${c.id}: year`);
    assert.ok(c.mag>0&&c.mag<=1.2,`${c.id}: mag`);
    assert.ok(['slr','rf','fx'].includes(c.kind),`${c.id}: kind`);
    for(const k of ['shut','ap']) assert.ok([null,'set','metered','both'].includes(c[k]),`${c.id}: ${k}`);
    for(const [kind] of c.disp) assert.equal(typeof D[kind],'function',`${c.id}: no readout called "${kind}" in D`);
  }
});

test('every bright-line frame fits inside its window', ()=>{
  const {CAMERAS}=load();
  for(const c of CAMERAS){ if(c.kind==='slr'||c.zoom) continue;
    assert.ok(c.win&&c.win.w>0&&c.win.h>0,`${c.id}: win`);
    for(const f of c.lens?[c.lens.f]:c.frames.flat()){ const hw=frameHalfWidth(c,f);
      assert.ok(hw<=c.win.w&&hw*2/3<=c.win.h,`${c.id}: the ${f} mm frame is larger than the window`); }
  }
});

test('sources are titled links with a note', ()=>{
  for(const s of load().SOURCES){ assert.equal(s.length,3); assert.match(s[1],/^https:\/\//); assert.ok(s[0]&&s[2]); }
});

test('every finder renders at every control setting', ()=>{
  const {CAMERAS,renderFinder}=load();
  for(const cam of CAMERAS) for(const lens of [28,35,50,85,135]) for(const auto of [false,true]) for(const film of [false,true])
    for(const [ev,Ni,Ti,u,dof] of [[5,0,13,0,false],[12,4,7,.25,true],[17,8,0,1/.7,false]]){
      const r=renderFinder(cam,'t-',{...BASE,lens,auto,film,ev,Ni,Ti,u,dof}), where=`${cam.id} at ${lens} mm`;
      assert.doesNotMatch(r.inner,/NaN|undefined|Infinity/,where);
      for(const v of Object.values(r.b)) assert.ok(Number.isFinite(v),where);
    }
});

test('README headline matches the catalog', ()=>{
  const {CAMERAS}=load(), ys=CAMERAS.map(c=>c.year), readme=fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
  const want=`${CAMERAS.length} film SLRs and rangefinders introduced ${Math.min(...ys)}–${Math.max(...ys)}`;
  assert.ok(readme.includes(want),`README.md should say "${want}"`);
});

test('the page starts and fills its default finders', ()=>{
  const app=load({app:true});
  assert.match(app.el('#lede').textContent,new RegExp(`on ${app.CAMERAS.length} film SLRs`));
  app.st.slots.forEach((id,i)=>assert.match(app.el('#svg-'+i).innerHTML,/<defs>/,id));
  assert.equal(app.el('#cat-title').textContent,`Cameras · ${app.CAMERAS.length} of ${app.CAMERAS.length}`);
});

test('catalog search ignores case and accents', ()=>{
  const app=load({app:true});
  const found=q=>{ app.el('#f-q').fire('input',{target:{value:q}}); return [...app.el('#tbl tbody').innerHTML.matchAll(/<tr data-id="([^"]+)"/g)].map(m=>m[1]); };
  assert.deepEqual(found('voigtlander'),BESSAS);
  assert.deepEqual(found(' Voigtländer '),BESSAS);
  assert.deepEqual(found('BESSA r2'),['voigtlander-bessa-r2']);
  assert.deepEqual(found('leica m6'),['leica-m6']);
  assert.equal(app.el('#cat-title').textContent,`Cameras · 1 of ${app.CAMERAS.length}`);
  assert.equal(found('').length,app.CAMERAS.length);
});

test('Bessa R and R2: Cosina figures for the shared 0.7× finder', ()=>{
  const {CAM,geom}=load();
  for(const id of BESSAS){ const c=CAM[id]; assert.ok(c,id);
    assert.equal(c.kind,'rf'); assert.equal(c.make,'Voigtländer'); assert.equal(c.mag,.7); assert.equal(c.fcov,.87); assert.equal(c.top,2000);
    assert.equal(JSON.stringify(c.frames),'[[35,90],[50],[75]]');
    assert.equal(Math.round(c.base*c.mag*1000),26,'37 mm base at 0.7×');
    assert.equal(c.auto,null); assert.equal(c.shut,null); assert.equal(c.ap,null); assert.equal(c.par,'auto');
    assert.equal(geom(c).ref,50); }
  assert.equal(CAM[BESSAS[0]].year,2000); assert.equal(CAM[BESSAS[1]].year,2002);
});

test('Bessa frame lever: 35 comes with 90, 50 stands alone, 28 and 135 have no frame', ()=>{
  const lib=load(), notes=lens=>lib.renderFinder(lib.CAM[BESSAS[0]],'t-',{...BASE,lens}).notes.join(' ');
  assert.match(notes(35),/Frames in view: 35 \+ 90 mm\. Yours is the 35\./);
  assert.match(notes(85),/Frames in view: 35 \+ 90 mm\. Yours is the 90\./);
  assert.equal(notes(50),'');
  assert.match(notes(28),/No 28 mm frame.*Showing the 35 mm frame/);
  assert.match(notes(135),/No 135 mm frame.*Showing the 90 mm frame/);
});

test('Bessa meter: dot when right, dot with an arrow when slightly off, arrow alone beyond', ()=>{
  const lib=load();
  for(const id of BESSAS){
    assert.deepEqual(leds(lib,id,12),{under:false,dot:true,over:false});
    assert.deepEqual(leds(lib,id,13),{under:false,dot:true,over:true});
    assert.deepEqual(leds(lib,id,14),{under:false,dot:false,over:true});
    assert.deepEqual(leds(lib,id,11),{under:true,dot:true,over:false});
    assert.deepEqual(leds(lib,id,10),{under:true,dot:false,over:false});
  }
});

test('Bessa LEDs sit in the gap of the 35 mm frame’s bottom line, not at the window edge', ()=>{
  const lib=load(), c=lib.CAM[BESSAS[0]], y=+readout(lib,BESSAS[0],{}).match(/<circle cx="0" cy="([\d.]+)" r="4\.2"/)[1]*lib.DS;
  const bottom=frameHalfWidth(c,35)*2/3;
  assert.ok(Math.abs(y-bottom)<8,`LED row at ${y}, 35 mm frame bottom at ${bottom}`);
  assert.ok(c.win.h-y>40,'well clear of the window edge');
});

test('Bessa patch is a sharp-edged oval; a Leica patch keeps its square corners', ()=>{
  const lib=load(), clip=id=>lib.renderFinder(lib.CAM[id],'t-',BASE).inner.match(/<clipPath id="t-cp"><rect [^>]*height="([\d.]+)" rx="([\d.]+)"/);
  const b=clip(BESSAS[0]), m=clip('leica-m6');
  assert.equal(+b[2],+b[1]/2,'fully rounded ends');
  assert.equal(m[2],'2');
});

test('Leica M6 keeps two arrows and no dot', ()=>{
  const lib=load();
  assert.deepEqual(leds(lib,'leica-m6',12),{under:true,dot:undefined,over:true});
  assert.deepEqual(leds(lib,'leica-m6',13),{under:false,dot:undefined,over:true});
  assert.deepEqual(leds(lib,'leica-m6',11),{under:true,dot:undefined,over:false});
});
