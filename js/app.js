'use strict';
/* app.js: page state, controls, the compare stage and the catalog table. */
/* ------------------------------------------------------------------
   APP
   ------------------------------------------------------------------ */
const $=(s,r=document)=>r.querySelector(s);
const st={slots:['pentax-spf','canon-ae1p','olympus-xa'],active:0,lens:50,u:.25,Ni:4,Ti:7,ev:13,auto:false,dof:false,film:false,scale:'true',ax:0,ay:45,ftype:'all',both:false,q:'',sortKey:'year',sortDir:1};
const KEEP=['slots','active','lens','u','Ni','Ti','ev','auto','dof','film','scale','ax','ay'];
function restore(){ try{ const s=JSON.parse(localStorage.getItem('vf-state')||'null'); if(!s) return;
  KEEP.forEach(k=>{ if(s[k]!==undefined) st[k]=s[k]; }); st.slots=(st.slots||[]).filter(id=>CAM[id]).slice(0,3); if(!st.slots.length) st.slots=['pentax-spf']; st.active=clamp(st.active|0,0,st.slots.length-1);
  if(!LENSES[st.lens]) st.lens=50; }catch(e){} }
const snap=()=>Object.fromEntries(KEEP.map(k=>[k,st[k]]));
const saveNow=()=>{ try{ localStorage.setItem('vf-state',JSON.stringify(snap())); }catch(e){} };
let saveT; function save(){ clearTimeout(saveT); saveT=setTimeout(saveNow,400); }
window.addEventListener('pagehide',saveNow);

const UMAX=1/.7, uOf=p=>UMAX*Math.pow(1-p/1000,1.7), pOf=u=>1000*(1-Math.pow(clamp(u,0,UMAX)/UMAX,1/1.7));
const KIND={slr:'SLR',rf:'Rangefinder',fx:'Fixed-lens rangefinder'};
const KSHORT={slr:'SLR',rf:'Rangefinder',fx:'Fixed-lens RF'};
const AID={sm:'Split image + microprism',split:'Split image',micro:'Microprism spot',plain:'Plain ground glass',fullmicro:'Microprism field',af:'Autofocus'};
const AIDS={sm:'Split + micro',split:'Split image',micro:'Microprism',plain:'Ground glass',fullmicro:'Micro field',af:'Autofocus'};
const aidOf=c=>c.kind==='slr'?AID[c.scr]:(c.af?'Autofocus':'Rangefinder patch');
const aidShort=c=>c.kind==='slr'?AIDS[c.scr]:(c.af?'Autofocus':'RF patch');
const kindOf=c=>c.klabel||KIND[c.kind];
const SHOW={set:'Your setting',metered:'Meter’s pick only',both:'Setting + meter'};
const MODE={M:'Manual',A:'Aperture-priority',S:'Shutter-priority',P:'Program'};
const est=(c,k)=>c.est.includes(k)?'≈':'';
const pct=v=>Math.round(v*1000)/10+'%';
function covText(c){ if(c.kind!=='slr') return c.base?`${Math.round(c.base*c.mag*1000)} mm base`:'—';
  const h=c.covH??c.cov, v=c.covV??c.cov; return est(c,'cov')+(h===v?pct(h):`${pct(h)} × ${pct(v)}`); }
const magText=c=>est(c,'mag')+c.mag.toFixed(2).replace(/0$/,'')+'×'+(c.magRef?` @${c.magRef}`:'');
const score=v=>v==='both'?3:v==='set'?2:v==='metered'?1:0;

/* ---------- stage ---------- */
const stage=$('#stage'); let last=[];
function options(sel){ return ['slr','rf','fx'].map(k=>`<optgroup label="${KIND[k]}">${CAMERAS.filter(c=>c.kind===k).map(c=>`<option value="${c.id}"${c.id===sel?' selected':''}>${c.make} ${c.model}</option>`).join('')}</optgroup>`).join(''); }
function buildStage(){
  stage.innerHTML=st.slots.map((id,i)=>`<article class="slot${i===st.active?' active':''}" data-i="${i}">
    <div class="slot-head"><span class="n">${i+1}</span><select id="sel-${i}" aria-label="Camera in finder ${i+1}">${options(id)}</select>${st.slots.length>1?`<button class="iconbtn" data-rm="${i}" type="button" aria-label="Remove finder ${i+1}">×</button>`:''}</div>
    <div class="eye" data-eye="${i}"><svg id="svg-${i}" role="img" preserveAspectRatio="xMidYMid meet"></svg></div>
    <div class="mini" id="mini-${i}"></div></article>`).join('')
    +(st.slots.length<3?`<button class="addslot" id="addslot" type="button">+ Add a camera to compare</button>`:'');
  $('#details').innerHTML=st.slots.map((id,i)=>`<article class="detail"><div class="cap" id="cap-${i}"></div></article>`).join('')+(st.slots.length<3?'<div></div>':'');
}
function addSlot(id){ if(st.slots.length>=3) return; const pick=id||CAMERAS.find(c=>!st.slots.includes(c.id)).id; st.slots.push(pick); st.active=st.slots.length-1; buildStage(); renderAll(true); }
stage.addEventListener('change',e=>{ const m=e.target.id.match(/^sel-(\d)$/); if(!m) return; st.slots[+m[1]]=e.target.value; st.active=+m[1]; markActive(); renderAll(true); });
stage.addEventListener('click',e=>{ const rm=e.target.closest('[data-rm]'); if(rm){ st.slots.splice(+rm.dataset.rm,1); st.active=clamp(st.active,0,st.slots.length-1); buildStage(); renderAll(true); return; }
  if(e.target.closest('#addslot')){ addSlot(); return; }
  const s=e.target.closest('.slot'); if(s&&+s.dataset.i!==st.active){ st.active=+s.dataset.i; markActive(); renderCatalog(); save(); } });
function markActive(){ stage.querySelectorAll('.slot').forEach(el=>el.classList.toggle('active',+el.dataset.i===st.active)); }

/* drag to aim */
let drag=null;
stage.addEventListener('pointerdown',e=>{ const eye=e.target.closest('.eye'); if(!eye) return; const i=+eye.dataset.eye, r=last[i]; if(!r) return;
  drag={i,x:e.clientX,y:e.clientY,ax:st.ax,ay:st.ay,k:r.vbw/eye.clientWidth/r.sc,eye}; eye.classList.add('drag'); try{ eye.setPointerCapture(e.pointerId); }catch(_){} });
stage.addEventListener('pointermove',e=>{ if(!drag) return; st.ax=clamp(drag.ax-(e.clientX-drag.x)*drag.k,-760,760); st.ay=clamp(drag.ay-(e.clientY-drag.y)*drag.k,-330,380); update(); });
const endDrag=()=>{ if(drag){ drag.eye.classList.remove('drag'); drag=null; save(); } };
stage.addEventListener('pointerup',endDrag); stage.addEventListener('pointercancel',endDrag);

function renderFinders(){
  const res=st.slots.map((id,i)=>renderFinder(CAM[id],`f${i}-`,st));
  let vb; if(st.scale==='true'){ const u={x0:Math.min(...res.map(r=>r.b.x0)),x1:Math.max(...res.map(r=>r.b.x1)),y0:Math.min(...res.map(r=>r.b.y0)),y1:Math.max(...res.map(r=>r.b.y1))}; vb=[u.x0,u.y0,u.x1-u.x0,u.y1-u.y0]; }
  res.forEach((r,i)=>{ const cam=CAM[st.slots[i]], svg=$('#svg-'+i); if(!svg) return;
    const v=st.scale==='true'?vb:st.scale==='center'?[-112,-76,224,152]:[r.b.x0,r.b.y0,r.b.x1-r.b.x0,r.b.y1-r.b.y0];
    svg.setAttribute('viewBox',v.map(r1).join(' ')); svg.setAttribute('aria-label',`Simulated viewfinder of the ${cam.make} ${cam.model}`);
    svg.innerHTML=`<rect x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}" fill="#000"/>`+r.inner; r.vbw=v[2];
    const g=geom(cam), M=r.ex.mode, lensTxt=cam.kind==='rf'&&!cam.zoom?`${st.lens===85?'90':st.lens} mm`:`${r.lens.f} mm f/${r.lens.N}`;
    const cell=(k,v,cls='')=>`<div><dt>${k}</dt><dd class="${cls}">${v}</dd></div>`;
    $('#mini-'+i).innerHTML=`<b>${magText(cam)}</b> · ${cam.kind==='slr'?covText(cam)+' of the frame':(cam.af?'autofocus':covText(cam))} · <b>${Math.round(deg(g.W))}° × ${Math.round(deg(g.H))}°</b>${cam.kind==='slr'?'':g.whole?' window':` for ${g.ref} mm`}`;
    $('#cap-'+i).innerHTML=`<div><h3><span class="n">${i+1}</span>${cam.make} ${cam.model}</h3><div class="yrs">${cam.years} · ${kindOf(cam)}</div></div>
      <dl class="spec">${cell('Magnification',magText(cam))}${cell(cam.kind==='slr'?'Coverage':'Effective base',covText(cam))}
      ${cell(cam.kind==='slr'?'Image at the eye':g.whole?'Window at the eye':`${g.ref} mm frame at the eye`,`${Math.round(deg(g.W))}° × ${Math.round(deg(g.H))}°`)}
      ${cell('Focus aid',aidOf(cam))}${cell('Shutter speed shown',cam.shut?SHOW[cam.shut]:'Not shown',cam.shut?'yes':'no')}${cell('Aperture shown',cam.ap?SHOW[cam.ap]:'Not shown',cam.ap?'yes':'no')}
      ${cell('Lens',lensTxt)}${cell('Exposure mode',MODE[M]+(M==='M'&&cam.meterM===false?', unmetered':''))}</dl>
      <p class="note">${cam.note}</p>${r.notes.map(n=>`<p class="flag">${n}</p>`).join('')}${cam.est.includes('layout')?'<p class="flag">Display layout here is a guess.</p>':''}`;
  });
  last=res;
}

/* ---------- controls ---------- */
const segs={lens:[[28,'28'],[35,'35'],[50,'50'],[85,'85–90'],[135,'135']],mode:[[false,'Manual'],[true,'Auto']],scale:[['true','True size'],['fit','Fit each'],['center','Centre ×5']]};
const TARGETS=[['Hydrant',2.5],['Photographer',4],['Kerb, sign, car',7],['Houses',60]];
function buildControls(){
  $('#seg-lens').innerHTML=segs.lens.map(([v,t])=>`<button type="button" data-lens="${v}">${t}</button>`).join('');
  $('#seg-mode').innerHTML=segs.mode.map(([v,t])=>`<button type="button" data-auto="${v}">${t}</button>`).join('');
  $('#seg-scale').innerHTML=segs.scale.map(([v,t])=>`<button type="button" data-scale="${v}">${t}</button>`).join('');
  $('#targets').innerHTML=TARGETS.map(([n,d])=>`<button class="chip" type="button" data-d="${d}">${n} · ${d>30?'∞':d+' m'}</button>`).join('');
  const ft=[2.5,3,4,5,7,10,15,30], m=[.7,1,1.5,2,3,5,10];
  $('#barrel').innerHTML=ft.map(v=>`<span class="ft" style="left:${pOf(1/(v*.3048))/10}%">${v}</span>`).join('')+`<span class="ft" style="left:100%">∞ ft</span>`
    +m.map(v=>`<span class="m" style="left:${pOf(1/v)/10}%">${v}</span><i style="left:${pOf(1/v)/10}%"></i>`).join('')+`<span class="m" style="left:100%">∞ m</span><i style="left:100%"></i>`;
  $('#controls').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.lens){ st.lens=+b.dataset.lens; } else if(b.dataset.auto){ st.auto=b.dataset.auto==='true'; } else if(b.dataset.scale){ st.scale=b.dataset.scale; }
    else if(b.dataset.d){ st.u=1/+b.dataset.d; } else if(b.id==='btn-center'){ st.ax=0; st.ay=45; } else return; update(); });
  $('#in-focus').addEventListener('input',e=>{ st.u=uOf(+e.target.value); update(); });
  $('#in-ap').addEventListener('input',e=>{ st.Ni=+e.target.value; update(); });
  $('#in-sh').addEventListener('input',e=>{ st.Ti=+e.target.value; update(); });
  $('#in-ev').addEventListener('input',e=>{ st.ev=+e.target.value; update(); });
  $('#in-dof').addEventListener('change',e=>{ st.dof=e.target.checked; update(); });
  $('#in-film').addEventListener('change',e=>{ st.film=e.target.checked; update(); });
}
const LIGHT={15:'Bright sun',14:'Hazy sun',13:'Cloudy bright',12:'Overcast',11:'Open shade',10:'Deep shade',9:'Dusk',8:'Bright interior',7:'Bright interior',6:'Interior',5:'Interior',4:'Dim interior',3:'Dim interior'};
const spdTxt=i=>i===0?'1 s':'1/'+SPD[i];
function syncControls(){
  document.querySelectorAll('[data-lens]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.lens===st.lens));
  document.querySelectorAll('[data-auto]').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.auto==='true')===st.auto));
  document.querySelectorAll('[data-scale]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.scale===st.scale));
  document.querySelectorAll('[data-d]').forEach(b=>b.setAttribute('aria-pressed',Math.abs(1/+b.dataset.d-st.u)<.004));
  $('#o-lens').textContent=`${st.lens===85?'85–90':st.lens} mm f/${LENSES[st.lens]}`;
  $('#in-focus').value=Math.round(pOf(st.u)); $('#o-focus').textContent=st.u<.018?'∞':`${(1/st.u).toFixed(1)} m · ${(1/st.u/.3048).toFixed(1)} ft`;
  $('#in-ap').value=st.Ni; $('#o-ap').textContent='f/'+STOPS[st.Ni];
  $('#in-sh').value=st.Ti; $('#o-sh').textContent=spdTxt(st.Ti);
  $('#in-ev').value=st.ev; $('#o-ev').textContent=`${LIGHT[st.ev-2]} · EV ${st.ev-2}`;
  $('#in-dof').checked=st.dof; $('#in-film').checked=st.film;
  const N=Math.max(STOPS[st.Ni],LENSES[st.lens]), tv=clamp(Math.round(st.ev-2*Math.log2(N)),0,13), over=st.ev-(2*Math.log2(N)+st.Ti), a=Math.abs(Math.round(over*2)/2);
  $('#meterline').innerHTML=`ISO 400. A hand meter gives <b>${spdTxt(tv)} at f/${N}</b>. Dialled in: <b>${spdTxt(st.Ti)} at f/${N}</b>, `
    +(a<.5?'on the meter.':`<span class="over">${a} stop${a===1?'':'s'} ${over>0?'over':'under'}</span>.`)+' Auto hands each camera whichever setting its own automation controls.';
}

/* ---------- catalog ---------- */
const COLS=[['name','Camera'],['kind','Type'],['year','Year'],['mag','Mag.'],['cov','Coverage / base'],['width','Apparent width'],['shut','Shutter in finder'],['ap','Aperture in finder'],['aid','Focus aid'],['',''] ];
const sortVal={name:c=>c.make+' '+c.model,kind:c=>['slr','rf','fx'].indexOf(c.kind),year:c=>c.year,mag:c=>c.mag,cov:c=>c.kind==='slr'?(c.covH??c.cov)*(c.covV??c.cov):c.base*c.mag,width:c=>geom(c).W,aid:c=>aidOf(c),shut:c=>score(c.shut),ap:c=>score(c.ap)};
function buildCatalog(){
  $('#filters').innerHTML=[['all','All'],['slr','SLR'],['rf','Rangefinder'],['fx','Fixed-lens']].map(([v,t])=>`<button class="chip" type="button" data-ft="${v}">${t}</button>`).join('')
    +`<button class="chip" type="button" id="f-both">Shows shutter + aperture</button><input type="search" id="f-q" placeholder="Search make or model" aria-label="Search cameras">`;
  $('#filters').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.ft) st.ftype=b.dataset.ft; else if(b.id==='f-both') st.both=!st.both; renderCatalog(); });
  $('#f-q').addEventListener('input',e=>{ st.q=e.target.value.trim().toLowerCase(); renderCatalog(); });
  $('#tbl thead').addEventListener('click',e=>{ const b=e.target.closest('button[data-k]'); if(!b) return; const k=b.dataset.k; if(st.sortKey===k) st.sortDir*=-1; else { st.sortKey=k; st.sortDir=['mag','width','shut','ap','cov'].includes(k)?-1:1; } renderCatalog(); });
  $('#tbl tbody').addEventListener('click',e=>{ const tr=e.target.closest('tr'); if(!tr) return; const id=tr.dataset.id;
    if(e.target.closest('.addbtn')){ addSlot(id); return; } st.slots[st.active]=id; buildStage(); renderAll(true); });
}
function renderCatalog(){
  document.querySelectorAll('[data-ft]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ft===st.ftype)); $('#f-both').setAttribute('aria-pressed',st.both);
  $('#tbl thead').innerHTML='<tr>'+COLS.map(([k,t])=>k?`<th${st.sortKey===k?` aria-sort="${st.sortDir>0?'ascending':'descending'}"`:''}><button type="button" data-k="${k}">${t}${st.sortKey===k?(st.sortDir>0?' ↑':' ↓'):''}</button></th>`:'<th></th>').join('')+'</tr>';
  const rows=CAMERAS.filter(c=>(st.ftype==='all'||c.kind===st.ftype)&&(!st.both||(c.shut&&c.ap))&&(!st.q||(c.make+' '+c.model).toLowerCase().includes(st.q)));
  const sv=sortVal[st.sortKey]; rows.sort((a,b)=>{ const x=sv(a),y=sv(b); return (x<y?-1:x>y?1:a.year-b.year)*st.sortDir; });
  const wmax=Math.max(...CAMERAS.map(c=>geom(c).W));
  $('#tbl tbody').innerHTML=rows.map(c=>{ const g=geom(c), si=st.slots.indexOf(c.id);
    return `<tr data-id="${c.id}"><td class="name">${si>=0?`<span class="badge">${si+1}</span>`:''}${c.make} ${c.model}</td><td class="dim">${c.kshort||KSHORT[c.kind]}</td><td>${c.year}</td><td class="num">${magText(c)}</td><td class="num">${covText(c)}</td>
      <td><span class="bar" style="width:${Math.round(g.W/wmax*72)}px"></span>${Math.round(deg(g.W))}°${c.kind!=='slr'&&!g.whole?` <span class="dim">@${g.ref}</span>`:''}</td>
      <td class="${c.shut?'':'dim'}">${c.shut?SHOW[c.shut]:'—'}</td><td class="${c.ap?'':'dim'}">${c.ap?SHOW[c.ap]:'—'}</td><td class="dim">${aidShort(c)}</td>
      <td>${si<0&&st.slots.length<3?'<button class="addbtn" type="button">+ Compare</button>':''}</td></tr>`; }).join('')
    ||`<tr><td colspan="10" class="dim">No camera matches. Clear the search or the filters.</td></tr>`;
  $('#cat-title').textContent=`Cameras · ${rows.length} of ${CAMERAS.length}`;
}

/* ---------- loop ---------- */
let pending=false;
function update(){ if(pending) return; pending=true; requestAnimationFrame(()=>{ pending=false; renderAll(false); }); }
function renderAll(cat){ syncControls(); renderFinders(); if(cat) renderCatalog(); save(); }

function start(){
  restore(); buildScene();
  const ys=CAMERAS.map(c=>c.year);
  $('#lede').textContent=`What the eyepiece shows on ${CAMERAS.length} film SLRs and rangefinders introduced ${Math.min(...ys)}–${Math.max(...ys)}. One scene, one lens, every finder drawn at the same angular scale, so a big finder looks big.`;
  $('#srcs').innerHTML=SOURCES.map(([t,u,n])=>`<li><a href="${u}">${t}</a>: ${n}</li>`).join('')
    +'<li>Other figures are published manufacturer specifications that were not re-checked for this prototype. Rangefinder window sizes are estimates throughout.</li>';
  buildControls(); buildCatalog(); buildStage(); renderAll(true);
}
start();
