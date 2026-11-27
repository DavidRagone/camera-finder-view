'use strict';
/* render.js: exposure maths, finder readouts, and the SLR and rangefinder renderers. */
/* ------------------------------------------------------------------
   RENDERING. Finder coordinates are 1000 x tan(apparent angle at the eye),
   origin at the centre of the frame, so every finder shares one scale.
   ------------------------------------------------------------------ */
const SPD=['1','2','4','8','15','30','60','125','250','500','1000','2000','4000','8000'];
const STOPS=[1.4,2,2.8,4,5.6,8,11,16,22];
const LENSES={28:2.8,35:2,50:1.8,85:2,135:2.8};
const WIN='#ccd1cb', LED='#ff4b38';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const r1=v=>Math.round(v*10)/10, r2=v=>Math.round(v*100)/100;
const TX=(x,y,s,size=12,fill='#111',anchor='middle',extra='')=>`<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(size)}" fill="${fill}" text-anchor="${anchor}" font-weight="600" ${extra}>${s}</text>`;
const NLIST=[1,1.2,1.4,1.7,1.8,2,2.5,2.8,3.5,4,4.5,5.6,6.7,8,9.5,11,13,16,19,22,27,32];
function fmtAv(av,exact){ if(exact) return String(exact); let b=NLIST[0],bd=9; NLIST.forEach(n=>{const d=Math.abs(2*Math.log2(n)-av); if(d<bd){bd=d;b=n;}}); if(b===1.7) b=1.8; return String(b); }
const fmtDist=u=>u<0.018?'∞':(1/u<10?(1/u).toFixed(1):Math.round(1/u))+' m';

/* seven-segment text for LED and LCD readouts */
const SEG={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg','-':'g','P':'abefg','F':'aefg','A':'abcefg','L':'def','C':'adef','H':'bcefg','E':'adefg','o':'cdeg','r':'eg','n':'ceg',' ':''};
function seg7(txt,x,y,h,col,anchor='start'){
  const w=h*.52,gap=h*.3,t=h*.13,items=[]; let cx=0;
  for(const ch of String(txt)){ if(ch==='.'){ items.push({dot:1,x:cx-gap*.5}); continue; } items.push({ch,x:cx}); cx+=w+gap; }
  const total=cx-gap, x0=anchor==='end'?x-total:anchor==='middle'?x-total/2:x;
  const P={a:[0,0,w,0],b:[w,0,w,h/2],c:[w,h/2,w,h],d:[0,h,w,h],e:[0,h/2,0,h],f:[0,0,0,h/2],g:[0,h/2,w,h/2]};
  let d='',dots='';
  items.forEach(it=>{
    if(it.dot){ dots+=`<circle cx="${r1(x0+it.x)}" cy="${r1(y)}" r="${r1(t*.62)}" fill="${col}"/>`; return; }
    (SEG[it.ch]||'').split('').forEach(sg=>{ let [x1,y1,x2,y2]=P[sg]; const i=t*.62; if(y1===y2){x1+=i;x2-=i;}else{y1+=i;y2-=i;}
      d+=`M${r1(x0+it.x+x1)} ${r1(y-h+y1)}L${r1(x0+it.x+x2)} ${r1(y-h+y2)}`; });
  });
  return `<g transform="translate(0 ${r1(y)}) skewX(-7) translate(0 ${r1(-y)})"><path d="${d}" stroke="${col}" stroke-width="${r1(t)}" stroke-linecap="round" fill="none"/>${dots}</g>`;
}

function lensFor(cam,st){
  if(cam.lens) return {f:cam.lens.f,N:cam.lens.N,fixed:true};
  if(cam.lensSet){ const crop=cam.crop||1; let best=cam.lensSet[0],bd=9;
    cam.lensSet.forEach(l=>{const d=Math.abs(Math.log(l.f*crop/st.lens)); if(d<bd){bd=d;best=l;}});
    return {f:best.f,N:best.N,sub:bd>.13,set:true}; }
  return {f:st.lens,N:LENSES[st.lens]};
}
function exposure(cam,st,lens){
  const AvOpen=2*Math.log2(lens.N), AvMin=2*Math.log2(cam.kind==='fx'?16:22);
  const TvMax=Math.round(Math.log2(cam.top)), ev=st.ev;
  const Nset=Math.max(STOPS[st.Ni],lens.N), Av=2*Math.log2(Nset), Tv=Math.min(st.Ti,TvMax);
  let mode='M'; if(cam.auto&&(st.auto||cam.manual===false)) mode=cam.auto;
  let Ave=Av,Tve=Tv,warn=0;
  if(mode==='A'){ const ti=ev-Av; Tve=clamp(Math.round(ti),0,TvMax); if(ti>TvMax+.5) warn=1; if(ti<-.5) warn=-1; }
  else if(mode==='S'){ const ai=ev-Tv; Ave=clamp(ai,AvOpen,AvMin); if(ai>AvMin+.3) warn=1; if(ai<AvOpen-.3) warn=-1; }
  else if(mode==='P'){ let a=clamp(ev*.5-1.5,AvOpen,AvMin), t=clamp(Math.round(ev-a),0,TvMax); a=clamp(ev-t,AvOpen,AvMin); Ave=a; Tve=t; const o=ev-(a+t); if(o>.5) warn=1; if(o<-.5) warn=-1; }
  return {mode,Av,Tv,Ave,Tve,over:ev-(Ave+Tve),warn,TvRec:clamp(Math.round(ev-Av),0,TvMax),AvRec:clamp(ev-Tv,AvOpen,AvMin),
    AvOpen,AvMin,TvMax,N:Math.pow(2,Ave/2),Nset,metered:!(mode==='M'&&cam.meterM===false),ev,lensN:lens.N};
}
const apText=(ex,av)=>Math.abs(av-ex.AvOpen)<.12?String(ex.lensN):fmtAv(av);

/* ---------------- finder displays ---------------- */
const D={};
D.needle=(c,o)=>{ const {W,H,ex}=c, dev=clamp(ex.over,-2.4,2.4)/2.4;
  if(o.side==='B'){ const x=o.x||0,y=H+22; c.b.y1=Math.max(c.b.y1,H+48);
    return `<g transform="translate(${x} ${y})"><rect x="-44" y="-12" width="88" height="24" rx="3" fill="${WIN}"/>${TX(-33,5,'+',15)}${TX(33,5,'−',15)}<path d="M0 -12v6M0 12v-6" stroke="#111" stroke-width="1.6"/><path d="M${r1(-dev*24)} -10V10" stroke="#111" stroke-width="2.4"/></g>`; }
  const s=o.side==='R'?1:-1, cy=(o.pos||0)*H; let xe=s*W, out='';
  if(o.notch){ out+=`<rect x="${s>0?W-1:-W-19}" y="${cy-34}" width="20" height="68" fill="${WIN}"/>`; c.b[s>0?'x1':'x0']=s*(W+44); xe=s*(W+19); }
  const ink='#0b0b0b', tx=xe-s*(o.notch?44:27), mx=xe-s*(o.notch?33:15);
  out+=TX(tx,cy-19,'+',15,ink)+TX(tx,cy+29,'−',15,ink);
  out+=`<path d="M${mx} ${cy-7}h${-s*12}M${mx} ${cy+7}h${-s*12}" stroke="${ink}" stroke-width="2"/>`;
  out+=`<path d="M${xe} ${r1(cy-dev*5)}L${xe-s*(o.notch?56:40)} ${r1(cy-dev*24)}" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  return out; };
D.lollipop=(c,o)=>{ const {W,H,ex}=c, out_=!!o.outside, x0=out_?W+10:W-34; if(out_) c.b.x1=Math.max(c.b.x1,W+58);
  const h=Math.min(H*.62,74), k=h/5.5, yN=clamp(-(ex.ev-11)*k,-h+5,h-5), yF=clamp(-((ex.Av+ex.Tv)-11)*k,-h+5,h-5);
  let s=`<rect x="${x0}" y="${r1(-h-8)}" width="30" height="${r1(2*h+16+(o.speed?24:0))}" rx="3" fill="${WIN}" opacity="${out_?1:.74}"/>`;
  s+=`<rect x="${x0}" y="${r1(-h-8)}" width="30" height="6" fill="#c8372d"/><rect x="${x0}" y="${r1(h+2)}" width="30" height="6" fill="#c8372d"/>`;
  s+=`<path d="M${x0+30} ${r1(yF)}H${x0+17}" stroke="#111" stroke-width="1.8"/><circle cx="${x0+11}" cy="${r1(yF)}" r="6.2" fill="none" stroke="#111" stroke-width="2"/>`;
  s+=`<path d="M${x0+30} ${r1(yN)}H${x0+3}" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>`;
  if(o.speed) s+=TX(x0+15,h+26,SPD[ex.Tv],12);
  return s; };
D.apscale=(c,o)=>{ const {W,H,ex}=c, stops=o.stops||[22,16,11,8,5.6,4,2.8,2,1.4], n=stops.length, ins=!!o.inside&&!o.outside;
  const dy=Math.min(14,(2*H-64)/(n-1)), w=32, x0=ins?W-w-4:W+10; if(!ins) c.b.x1=Math.max(c.b.x1,W+w+26);
  const y0=-(n-1)*dy/2, avs=stops.map(v=>2*Math.log2(v));
  const yOf=av=>{ if(av>=avs[0]) return y0-Math.min(1,av-avs[0])*dy*.95; if(av<=avs[n-1]) return y0+(n-1)*dy+Math.min(1,avs[n-1]-av)*dy*.95;
    for(let i=0;i<n-1;i++) if(av<=avs[i]&&av>=avs[i+1]) return y0+(i+(avs[i]-av)/(avs[i]-avs[i+1]))*dy; return y0; };
  const top=y0-dy-6;
  let s=`<rect x="${x0}" y="${r1(top)}" width="${w}" height="${r1((n+1)*dy+12+(o.speed?24:0))}" rx="3" fill="${WIN}" opacity="${ins?.7:1}"/>`;
  s+=`<rect x="${x0}" y="${r1(top)}" width="${w}" height="${r1(dy*.7)}" fill="#c8372d"/><rect x="${x0}" y="${r1(y0+(n-1)*dy+dy*.62)}" width="${w}" height="${r1(dy*.7)}" fill="#c8372d"/>`;
  stops.forEach((v,i)=>{ s+=TX(x0+12,y0+i*dy+4,v,Math.min(11,dy*.86),'#0c0c0c'); });
  const metAv=ex.mode==='P'?ex.Ave:ex.ev-ex.Tv;
  if(ex.metered) s+=`<path d="M${x0+w} ${r1(yOf(metAv))}H${x0+21}" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>`;
  if(o.follower) s+=`<circle cx="${x0+26}" cy="${r1(yOf(ex.Av))}" r="4.4" fill="none" stroke="#111" stroke-width="1.8"/>`;
  if(o.mled&&ex.mode==='M'){ s+=`<circle cx="${x0+w/2}" cy="${r1(top-13)}" r="10" fill="${LED}" opacity=".22"/>`+TX(x0+w/2,top-8,'M',14,LED); c.b.y0=Math.min(c.b.y0,top-40); }
  if(o.speed) s+=TX(x0+w/2,y0+(n-1)*dy+dy+22,SPD[ex.Tv],12);
  return s; };
D.apled=(c,o)=>{ const {W,H,ex}=c, w=34, x0=W+10; c.b.x1=Math.max(c.b.x1,W+w+26);
  const stops=[32,22,16,11,8,5.6,4,2.8,2,1.4,1], dy=Math.min(13,(2*H-70)/10), y0=-5*dy+11, av=ex.mode==='M'?ex.ev-ex.Tv:ex.Ave;
  let bi=0,bd=99; stops.forEach((v,i)=>{const d=Math.abs(2*Math.log2(v)-clamp(av,0,10)); if(d<bd){bd=d;bi=i;}});
  let s=`<rect x="${x0}" y="${r1(y0-34)}" width="${w}" height="${r1(10*dy+48)}" rx="3" fill="#070707"/>`;
  stops.forEach((v,i)=>{ if(i===bi) s+=`<circle cx="${x0+w/2}" cy="${r1(y0+i*dy)}" r="9" fill="${LED}" opacity=".2"/>`; s+=TX(x0+w/2,y0+i*dy+4,v,Math.min(11,dy*.9),i===bi?LED:'#2c1613'); });
  s+=TX(x0+w/2,y0-17,ex.mode==='M'?'M':'P',14,ex.mode==='M'?LED:'#58e06a');
  return s; };
D.speedscale=(c,o)=>{ const {W,H,ex}=c, iTop=ex.TvMax, n=iTop+1, marks=o.marks||[], mh=marks.length?18:0;
  const dy=Math.min(13,(2*H-44-mh)/(n-1)), w=o.led?38:34, fs=Math.min(11,dy*.9), R_=o.side==='R', ins=!!o.inside; let x0;
  if(R_){ x0=ins?W-w-4:W+10; if(!ins) c.b.x1=Math.max(c.b.x1,W+w+26); } else { x0=ins?-W+4:-W-10-w; if(!ins) c.b.x0=Math.min(c.b.x0,-W-w-26); }
  const dark=o.dark??!!o.led, ink=dark?'#dedcd2':'#0d0d0d', y0=-(n-1)*dy/2+mh/2, top=y0-12-mh;
  const numX=R_?x0+w-13:x0+13, indX=R_?x0+7:x0+w-7, yOf=tv=>r1(y0+(iTop-tv)*dy);
  let s=`<rect x="${x0}" y="${r1(top)}" width="${w}" height="${r1((n-1)*dy+24+mh)}" rx="3" fill="${dark?'#060606':WIN}" opacity="${ins?(dark?.82:.66):1}"/>`;
  for(let i=iTop;i>=0;i--) s+=TX(numX,yOf(i)+fs*.36,SPD[i],fs,ink);
  marks.forEach((k,j)=>{ const on=k===ex.mode; s+=TX(x0+w/2+(j-(marks.length-1)/2)*11.5,top+14,k,11,on?(o.led?LED:'#0d0d0d'):(dark?'#55534c':'#8d918c')); });
  const led=(y,ring)=>ring?`<circle cx="${indX}" cy="${y}" r="3.4" fill="none" stroke="${LED}" stroke-width="1.6"/>`:`<circle cx="${indX}" cy="${y}" r="6.5" fill="${LED}" opacity=".28"/><circle cx="${indX}" cy="${y}" r="3.1" fill="#ff5d48"/>`;
  const ndl=(y,col,sw)=>`<path d="M${R_?x0:x0+w} ${y}H${R_?x0+13:x0+w-13}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
  if(ex.metered){
    const self=ex.mode==='M'&&o.set==='self', tvMet=ex.mode==='M'?(self?ex.Tv:ex.TvRec):ex.Tve;
    s+=o.led?led(yOf(tvMet)):ndl(yOf(tvMet),'#0b0b0b',2.4);
    const w_=ex.mode==='M'?(self?(ex.over>.5?1:ex.over<-.5?-1:0):0):ex.warn;
    if(w_) s+=`<path d="M${indX-4} ${w_>0?top+7:yOf(0)+11}h8l-4 ${w_>0?-6:6}z" fill="${o.led?LED:'#0b0b0b'}"/>`;
  }
  if(ex.mode==='M'&&o.set==='flag') s+=`<rect x="${x0+2}" y="${r1(yOf(ex.Tv)-dy/2)}" width="${w-4}" height="${r1(dy)}" fill="#3b7bff" opacity=".5"/>`;
  if(ex.mode==='M'&&o.set==='green') s+=ndl(yOf(ex.Tv),'#18a04a',3.6);
  if(ex.mode==='M'&&o.set==='both') s+=led(yOf(ex.Tv),true);
  return s; };
D.om2=(c,o)=>c.ex.mode==='M'?D.needle(c,{side:'L',pos:.45,inside:true}):D.speedscale(c,{side:'L',inside:true});
D.leds=(c,o)=>{ const {W,ex}=c, w=o.speed?48:22, x0=W-w-5, ov=ex.over, cx=x0+11;
  let s=`<rect x="${x0}" y="-37" width="${w}" height="74" rx="3" fill="#060606" opacity=".84"/>`;
  const on=(b,col=LED)=>b?col:'#2c1613';
  if(o.n===3){ const lit=[ov>.2,Math.abs(ov)<=1,ov<-.2];
    lit.forEach((b,i)=>{ if(b) s+=`<circle cx="${cx}" cy="${-22+i*22}" r="9" fill="${LED}" opacity=".22"/>`; });
    s+=`<path d="M${cx-5} -22h10M${cx} -27v10" stroke="${on(lit[0])}" stroke-width="2.6"/><circle cx="${cx}" cy="0" r="4.6" fill="none" stroke="${on(lit[1])}" stroke-width="2.4"/><path d="M${cx-5} 22h10" stroke="${on(lit[2])}" stroke-width="2.6"/>`;
  } else { const cols=[LED,'#ffc93a','#49d16a','#ffc93a',LED], idx=ov>=1?0:ov>=.4?1:ov>-.4?2:ov>-1?3:4;
    cols.forEach((col,i)=>{ const y=-26+i*13; if(i===idx) s+=`<circle cx="${cx}" cy="${y}" r="8" fill="${col}" opacity=".25"/>`; s+=`<circle cx="${cx}" cy="${y}" r="3.4" fill="${i===idx?col:'#26221c'}"/>`; });
    if(o.speed){ s+=TX(x0+33,5,SPD[ex.Tv],13,'#f1efe6'); if(ex.Tv<ex.TvMax) s+=TX(x0+33,-17,SPD[ex.Tv+1],10,'#77756d'); if(ex.Tv>0) s+=TX(x0+33,26,SPD[ex.Tv-1],10,'#77756d'); }
  }
  return s; };
D.seg=(c,o)=>{ const {W,H,ex}=c; c.b.y1=Math.max(c.b.y1,H+54); const y=H+36, M=ex.mode==='M';
  let s=seg7(SPD[M?ex.Tv:ex.Tve],-14,y,18,LED,'end')+seg7(apText(ex,M?ex.Av:ex.Ave),14,y,18,LED,'start');
  if(M) s+=TX(86,y,'M',17,LED);
  return s; };
D.lcd=(c,o)=>{ const {W,H,ex}=c; c.b.y0=Math.min(c.b.y0,-H-52); const x=-W*.42, y=-H-11, ink='#1b1f18', M=ex.mode==='M';
  let s=`<rect x="${r1(x-36)}" y="${r1(y-22)}" width="72" height="24" rx="2" fill="#aeb7a2"/>`+seg7(SPD[M?ex.Tv:ex.Tve],x+29,y-4,14,ink,'end');
  if(M){ s+=TX(x-26,y-5,'M',11,ink); if(ex.over>-.25) s+=TX(x-13,y-12,'+',11,ink); if(ex.over<.25) s+=TX(x-13,y-2,'−',11,ink); }
  return s; };
D.adr=(c,o)=>{ const {H,ex}=c, T=o.pos==='T', y=T?-H-15:H+15, x=o.dx||0; if(T) c.b.y0=Math.min(c.b.y0,-H-48); else c.b.y1=Math.max(c.b.y1,H+48);
  return `<rect x="${x-18}" y="${y-10}" width="36" height="20" rx="2" fill="#1b1b1a" stroke="#3d3d39"/>`+TX(x,y+4.5,apText(ex,ex.Av),12,'#f1efe6'); };
D.speedwin=(c,o)=>{ const {W,H,ex}=c, t=SPD[ex.Tv];
  if(o.pos==='L') return `<rect x="${-W+4}" y="-11" width="36" height="22" rx="2" fill="${WIN}" opacity=".72"/>`+TX(-W+22,5,t,13,'#0c0c0c');
  if(o.inside) return `<rect x="-21" y="${-H+5}" width="42" height="20" rx="2" fill="${WIN}" opacity=".7"/>`+TX(0,-H+19.5,t,13,'#0c0c0c');
  const T=o.pos==='T', y=T?-H-15:H+15, x=o.dx||0; if(T) c.b.y0=Math.min(c.b.y0,-H-48); else c.b.y1=Math.max(c.b.y1,H+48);
  let s=`<rect x="${x-(o.nb?46:20)}" y="${y-10}" width="${o.nb?92:40}" height="20" rx="2" fill="${WIN}"/>`+TX(x,y+4.5,t,13,'#0c0c0c');
  if(o.nb){ if(ex.Tv>0) s+=TX(x-31,y+4,SPD[ex.Tv-1],10,'#666a65'); if(ex.Tv<ex.TvMax) s+=TX(x+31,y+4,SPD[ex.Tv+1],10,'#666a65'); }
  return s; };
D.speedstrip=(c,o)=>{ const {W,H,ex}=c, n=ex.TvMax+1, w=Math.min(2*W-36,n*30), dx=w/n, ins=!!o.inside, T=o.pos==='T';
  const y=T?(ins?-H+17:-H-15):(ins?H-17:H+15); if(!ins){ if(T) c.b.y0=Math.min(c.b.y0,-H-48); else c.b.y1=Math.max(c.b.y1,H+48); }
  let s=`<rect x="${r1(-w/2)}" y="${y-10}" width="${r1(w)}" height="20" rx="2" fill="${WIN}" opacity="${ins?.68:1}"/>`;
  for(let i=0;i<n;i++){ const x=-w/2+dx*(i+.5); s+=TX(x,y+4,SPD[i],Math.min(10.5,dx*.42),'#0c0c0c');
    if(i===ex.Tv) s+=`<rect x="${r1(x-dx/2+1)}" y="${y-9}" width="${r1(dx-2)}" height="18" fill="none" stroke="#0c0c0c" stroke-width="1.8"/>`; }
  return s; };
D.lcdbar=(c,o)=>{ const {W,H,ex,st}=c; c.b.y1=Math.max(c.b.y1,H+54); const green=o.style==='green', fg=green?'#7dfc7a':'#1b1f18', M=ex.mode==='M';
  const w=Math.min(2*W,300), y=H+31;
  let s=`<rect x="${r1(-w/2)}" y="${H+9}" width="${r1(w)}" height="29" rx="2" fill="${green?'#040704':'#aeb7a2'}"/>`+seg7(SPD[M?ex.Tv:ex.Tve],-w/2+64,y,15,fg,'end');
  if(o.g2){ const u=st.u, ds=u<.018?'∞':(1/u).toFixed(1)+' m'; s+=TX(12,y-2,ds,15,fg)+`<circle cx="${r1(w/2-22)}" cy="${y-8}" r="4" fill="${fg}"/>`; return s; }
  s+=seg7(apText(ex,M?ex.Av:ex.Ave),-w/2+80,y,15,fg,'start');
  const sx=w/2-70, ov=clamp(M?ex.over:0,-2,2);
  for(let k=-2;k<=2;k++) s+=`<path d="M${r1(sx+k*12)} ${y-(k?4:8)}V${y}" stroke="${fg}" stroke-width="1.6"/>`;
  s+=`<path d="M${r1(sx+ov*12-3.5)} ${y-16}h7l-3.5 6z" fill="${fg}"/>`+TX(sx-32,y-2,'−',12,fg)+TX(sx+32,y-2,'+',12,fg)+TX(w/2-12,y-2,M?'M':ex.mode==='A'?'A':'P',12,fg);
  return s; };
/* Autofocus bodies confirm focus electronically. Here the mark lights when anything in the scene sits at the focused distance. */
function focusState(st){ let bd=9; LAY.forEach(L=>{ const d=L.inv-st.u; if(Math.abs(d)<Math.abs(bd)) bd=d; }); return {ok:Math.abs(bd)<.012,dir:Math.sign(bd)}; }
/* Canon EOS: lit characters on a dark strip below the image. o.m: M mark (650). o.op: manual level shown as OP / CL / oo in the
   aperture digits (650). o.scale: 'right' = exposure-level scale beside the image (EOS-1N, EOS-3), 'bottom' = scale in the strip. */
D.eos=(c,o)=>{ const {W,H,ex,st}=c; c.b.y1=Math.max(c.b.y1,H+54); const fg='#c6f25c', dim='#1c2a10', M=ex.mode==='M';
  const w=Math.min(2*W,300), y=H+31, x0=-w/2, fs=focusState(st), ov=M?ex.over:0;
  let s=`<rect x="${r1(x0)}" y="${H+9}" width="${r1(w)}" height="29" rx="2" fill="#030503"/>`, x=x0+8;
  if(o.m){ s+=TX(x+5,y-1,'M',13,M?fg:dim); x+=15; }
  s+=TX(x+5,y+4,'*',17,dim); x+=14;
  s+=seg7(SPD[M?ex.Tv:ex.Tve],x+52,y,15,fg,'end'); x+=66;
  s+=seg7(o.op&&M?(ov>.35?'CL':ov<-.35?'0P':'oo'):apText(ex,M?ex.Av:ex.Ave),x,y,15,fg,'start');
  if(o.scale==='bottom'){ const sx=x0+w-70, R=o.range||2, v=clamp(ov,-R,R);
    for(let q=-R*2;q<=R*2;q++) s+=`<path d="M${r1(sx+q*7)} ${y-(q%2?3:q?6:9)}V${y}" stroke="${fg}" stroke-width="1.4"/>`;
    s+=TX(sx-R*14-9,y-1,'−',11,fg)+TX(sx+R*14+9,y-1,'+',11,fg)+`<path d="M${r1(sx+v*14-3.5)} ${y-16}h7l-3.5 5z" fill="${fg}"/>`; }
  s+=`<circle cx="${r1(x0+w-11)}" cy="${y-7}" r="4.2" fill="${fs.ok?fg:dim}"/>`;
  if(o.scale==='right'){ const R=o.range||3, h=Math.min(H-12,R*25), xs=W+12, v=clamp(ov,-R,R); c.b.x1=Math.max(c.b.x1,W+52);
    s+=`<rect x="${r1(W+7)}" y="${r1(-h-12)}" width="30" height="${r1(2*h+24)}" rx="2" fill="#030503"/>`;
    for(let q=-R*3;q<=R*3;q++){ const yy=-q*h/(R*3), big=q%3===0; s+=`<path d="M${r1(xs)} ${r1(yy)}h${big?(q?8:11):4}" stroke="${fg}" stroke-width="${big?1.6:1.1}"/>`;
      if(big&&q) s+=TX(xs+16,yy+3.2,Math.abs(q/3),8.5,fg); }
    s+=TX(xs+16,-h-3,'+',9,fg)+TX(xs+16,h+9,'−',9,fg)+`<path d="M${r1(xs-1)} ${r1(-v*h/R)}l-6 -3.5v7z" fill="${fg}"/>`; }
  return s; };
/* Nikon: dark characters on a pale green LCD below the image. o.focus / o.counter: 'bottom' (F5, F100) or 'top' (F4, where the
   finder head carries red and green focus LEDs and its own small frame-counter LCD). o.ap:false leaves the f-number to the ADR window. */
D.nikon=(c,o)=>{ const {W,H,ex,st}=c; c.b.y1=Math.max(c.b.y1,H+54); const ink='#1b1f18', faint='#939c88', M=ex.mode==='M';
  const w=Math.min(2*W,310), y=H+31, x0=-w/2, fs=focusState(st), ov=clamp(M?ex.over:0,-2,2);
  const focus=(fx,fy,led)=>{ const on=led?[LED,'#49d16a',LED]:[ink,ink,ink], off=led?'#2c1613':faint, front=!fs.ok&&fs.dir<0, rear=!fs.ok&&fs.dir>0;
    return `<path d="M${r1(fx)} ${r1(fy-5)}v10l8 -5z" fill="${front?on[0]:off}"/><circle cx="${r1(fx+15)}" cy="${r1(fy)}" r="4" fill="${fs.ok?on[1]:off}"/><path d="M${r1(fx+30)} ${r1(fy-5)}v10l-8 -5z" fill="${rear?on[2]:off}"/>`; };
  let s=`<rect x="${r1(x0)}" y="${H+9}" width="${r1(w)}" height="29" rx="2" fill="#aeb7a2"/>`, x=x0+8;
  if(o.focus==='bottom'){ s+=focus(x,y-7,false); x+=40; }
  s+=`<rect x="${r1(x)}" y="${y-13}" width="15" height="11" rx="2" fill="none" stroke="${ink}" stroke-width="1.3"/><circle cx="${r1(x+7.5)}" cy="${y-7.5}" r="1.8" fill="${ink}"/>`; x+=22;
  s+=seg7(SPD[M?ex.Tv:ex.Tve],x+52,y,15,ink,'end'); x+=60;
  if(o.ap!==false){ s+=TX(x+3,y-1,'F',12,ink)+seg7(apText(ex,M?ex.Av:ex.Ave),x+10,y,15,ink,'start'); x+=44; }
  s+=TX(x+6,y-1,ex.mode,13,ink); x+=20;
  const sx=x+36; s+=TX(sx-32,y-2,'+',12,ink)+TX(sx+32,y-2,'−',12,ink);
  for(let q=-2;q<=2;q++) s+=`<path d="M${r1(sx+q*12)} ${y-(q?4:9)}V${y}" stroke="${ink}" stroke-width="1.5"/>`;
  if(Math.abs(ov)>.15) s+=`<rect x="${r1(Math.min(sx,sx-ov*12))}" y="${y-15}" width="${r1(Math.abs(ov)*12)}" height="4" fill="${ink}"/>`;
  if(o.counter==='bottom') s+=seg7('12',x0+w-7,y,13,ink,'end');
  if(o.focus==='top'||o.counter==='top') c.b.y0=Math.min(c.b.y0,-H-48);
  if(o.focus==='top') s+=focus(W*.46,-H-15,true);
  if(o.counter==='top') s+=`<rect x="${r1(-W*.46-36)}" y="${-H-26}" width="40" height="21" rx="2" fill="#aeb7a2"/>`+seg7('12',-W*.46-3,-H-9,12,ink,'end');
  return s; };
D.om4=(c,o)=>{ const {W,H,ex}=c; c.b.y1=Math.max(c.b.y1,H+54); const ink='#1b1f18', w=Math.min(2*W-10,330), y=H+31, M=ex.mode==='M', x0=-w/2;
  let s=`<rect x="${r1(x0)}" y="${H+9}" width="${r1(w)}" height="29" rx="2" fill="#aeb7a2"/>`;
  if(!M){ const n=ex.TvMax+1, dx=(w-16)/n; for(let i=0;i<n;i++) s+=TX(x0+8+dx*(i+.5),y-11,SPD[i],Math.min(9.5,dx*.4),ink);
    s+=`<rect x="${r1(x0+8)}" y="${y-7}" width="${r1(dx*(ex.Tve+.5))}" height="5" fill="${ink}"/>`; }
  else { s+=seg7(SPD[ex.Tv],x0+58,y,15,ink,'end'); const cx=x0+w*.62, ov=clamp(ex.over,-3,3);
    s+=TX(cx-70,y-3,'−',13,ink)+TX(cx+70,y-3,'+',13,ink)+`<path d="M${r1(cx-4)} ${y-20}h8l-4 6z" fill="${ink}"/>`;
    for(let k=-3;k<=3;k++) s+=`<path d="M${r1(cx+k*18)} ${y-12}v3" stroke="${ink}" stroke-width="1.4"/>`;
    s+=`<rect x="${r1(Math.min(cx,cx+ov*18))}" y="${y-7}" width="${r1(Math.max(2,Math.abs(ov)*18))}" height="5" fill="${ink}"/>`; }
  return s; };
/* Leica M5: the meter needle moves with the light reaching the cell (so with the aperture too);
   the hairline moves with the shutter speed. Exposure is as metered when they cross on the centre line. */
D.m5=(c,o)=>{ const {H,ex}=c, y=H-17, k=8.5, cx=24, hw=60, ink='#0c0c0c';
  const xn=clamp(cx+(ex.ev-ex.Av-6.5)*k,cx-hw+10,cx+hw-10), xh=clamp(cx+(ex.Tv-6.5)*k,cx-hw+10,cx+hw-10);
  return `<rect x="-88" y="${y-11}" width="176" height="22" rx="2" fill="${WIN}" opacity=".72"/>`+TX(-66,y+4.5,SPD[ex.Tv],12,ink)
   +`<path d="M${cx-hw} ${y}H${cx+hw}" stroke="${ink}" stroke-width=".8" opacity=".5"/>`
   +`<path d="M${cx-hw-3} ${y-3}a3 3 0 0 0 0 6z" fill="${ink}"/><path d="M${cx+hw+3} ${y-6}a6 6 0 0 1 0 12z" fill="${ink}"/>`
   +`<path d="M${r1(xh+10)} ${y+10}L${r1(xh-10)} ${y-10}" stroke="${ink}" stroke-width="1.1" stroke-linecap="round"/>`
   +`<path d="M${r1(xn-10)} ${y+10}L${r1(xn+10)} ${y-10}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`; };
/* Two LED arrows at the bottom of the window: the left one lights for under, the right one for over. Leica M6: both light when
   exposure is right. o.dot (Bessa R, R2): a round LED between them. Dot alone is right, dot with an arrow slightly off, an arrow
   alone further off. The Bessa manual names those five states without figures; the half-stop and one-stop steps here are a guess.
   o.y: height of the row in finder units below the centre, for LEDs that sit above the window's bottom edge. */
D.arrows=(c,o)=>{ const {H,ex}=c, y=o.y?r1(o.y/DS):H-18, ov=ex.over, g=o.dot?12:6, col=b=>b?LED:'#3a1a16';
  const l=o.dot?ov<-.4:ov<.3, r=o.dot?ov>.4:ov>-.3, m=!!o.dot&&Math.abs(ov)<1.1;
  const glow=(x,b)=>b?`<circle cx="${x}" cy="${y}" r="10" fill="${LED}" opacity=".2"/>`:'';
  return glow(-g-5,l)+glow(g+5,r)+(o.dot?glow(0,m)+`<circle cx="0" cy="${y}" r="4.2" fill="${col(m)}"/>`:'')
   +`<path d="M${-g-11} ${y-7}v14l11 -7z" fill="${col(l)}"/><path d="M${g+11} ${y-7}v14l-11 -7z" fill="${col(r)}"/>`; };
D.yashica=(c,o)=>{ const {W,H,ex}=c, ti=ex.ev-ex.Av, over=ti>9.5, slow=ti<5, y=-H+19;
  return (slow?`<circle cx="-40" cy="${y}" r="13" fill="#ffc93a" opacity=".22"/>`:'')+(over?`<circle cx="40" cy="${y}" r="13" fill="${LED}" opacity=".22"/>`:'')
   +`<path d="M-28 ${y-5}h-14v-4l-10 9l10 9v-4h14z" fill="${slow?'#ffc93a':'#4a3d16'}"/><path d="M28 ${y-5}h14v-4l10 9l-10 9v-4h-14z" fill="${over?LED:'#4a1d18'}"/>`; };
D.evscale=(c,o)=>{ const {W,H,ex}=c, w=Math.min(2*W-60,330), y=-H+17, x0=-w/2, dx=w/15; let s=`<rect x="${r1(x0)}" y="${y-11}" width="${r1(w)}" height="22" rx="2" fill="${WIN}" opacity=".68"/>`;
  for(let e=3;e<=17;e++){ const x=x0+dx*(e-2.5); if(e%2) s+=TX(x,y+4,e,10.5,'#0c0c0c'); else s+=`<circle cx="${r1(x)}" cy="${y}" r="1.4" fill="#0c0c0c"/>`; }
  const xn=x0+dx*(clamp(ex.ev,2.6,17.4)-2.5); return s+`<path d="M${r1(xn)} ${y-11}v22" stroke="#0c0c0c" stroke-width="2.2"/>`; };
D.apstrip=(c,o)=>{ const {W,H,ex}=c, stops=[2.8,4,5.6,8,11,16,22], n=stops.length, w=Math.min(2*W-50,250), dx=w/(n+1), y=H-17, x0=-w/2;
  let s=`<rect x="${r1(x0)}" y="${y-10}" width="${r1(w)}" height="20" rx="2" fill="${WIN}" opacity=".68"/><rect x="${r1(x0)}" y="${y-10}" width="${r1(dx*.55)}" height="20" fill="#c8372d"/><rect x="${r1(x0+w-dx*.55)}" y="${y-10}" width="${r1(dx*.55)}" height="20" fill="#c8372d"/>`;
  stops.forEach((v,i)=>{ s+=TX(x0+dx*(i+1),y+4,v,10.5,'#0c0c0c'); });
  const av=ex.ev-ex.Tv, pos=clamp((av-2*Math.log2(2.8))/2,-.8,n-.2); return s+`<path d="M${r1(x0+dx*(pos+1))} ${y-10}v20" stroke="#0c0c0c" stroke-width="2.2"/>`; };
D.hexaf=(c,o)=>{ const {W,ex}=c, x=-W+17, M=ex.mode==='M';
  return `<circle cx="${x}" cy="-24" r="8" fill="#49d16a" opacity=".22"/><circle cx="${x}" cy="-24" r="3.6" fill="#49d16a"/>`
   +`<path d="M${x-5} 0h10M${x} -5v10" stroke="${M&&ex.over>.4?LED:'#3a1a16'}" stroke-width="2.4"/><path d="M${x-5} 20h10" stroke="${M&&ex.over<-.4?LED:'#3a1a16'}" stroke-width="2.4"/>`; };

/* readouts are drawn 1.38x: real finder numerals are about 1.5 mm tall on the screen */
const DS=1.38;
function drawDisplays(cam,W,H,ex,p,b,st){ if(!cam.disp.length) return '';
  const c={W:W/DS,H:H/DS,ex,cam,p,st,b:{x0:b.x0/DS,x1:b.x1/DS,y0:b.y0/DS,y1:b.y1/DS}}; let out='';
  cam.disp.forEach(([kind,o])=>{ out+=D[kind](c,o); });
  b.x0=Math.min(b.x0,c.b.x0*DS); b.x1=Math.max(b.x1,c.b.x1*DS); b.y0=Math.min(b.y0,c.b.y0*DS); b.y1=Math.max(b.y1,c.b.y1*DS);
  return `<g transform="scale(${DS})">${out}</g>`; }
function afMarks(type,k,col){ const sw=1.3, br=(x,y,w,h)=>`<path d="M${r1(x-w+3)} ${r1(y-h)}h-3v${r1(2*h)}h3M${r1(x+w-3)} ${r1(y-h)}h3v${r1(2*h)}h-3" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
  const sq=(x,y,s)=>`<rect x="${r1(x-s)}" y="${r1(y-s)}" width="${r1(2*s)}" height="${r1(2*s)}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
  if(type==='rect') return `<rect x="${r1(-1.7*k)}" y="${r1(-.85*k)}" width="${r1(3.4*k)}" height="${r1(1.7*k)}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
  if(type==='bracket') return br(0,0,2.2*k,1.1*k);
  if(type==='cross5') return br(0,0,1.4*k,.75*k)+br(-6.2*k,0,1.4*k,.75*k)+br(6.2*k,0,1.4*k,.75*k)+br(0,-4.4*k,1.4*k,.75*k)+br(0,4.4*k,1.4*k,.75*k);
  if(type==='row5') return [-6.6,-3.3,0,3.3,6.6].map(x=>sq(x*k,0,.6*k)).join('');
  if(type==='row3') return [-6,0,6].map(x=>sq(x*k,0,.7*k)).join('');
  if(type==='ellipse45'){ let s=`<ellipse cx="0" cy="0" rx="${r1(8.6*k)}" ry="${r1(4.2*k)}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
    [[0,11],[1.15,10],[2.3,7],[3.3,5]].forEach(([y,n])=>{ [y,-y].forEach((yy,j)=>{ if(!y&&j) return; for(let i=0;i<n;i++){ const x=(i-(n-1)/2)*1.42; s+=`<rect x="${r1(x*k-2)}" y="${r1(yy*k-2)}" width="4" height="4" fill="none" stroke="${col}" stroke-width=".8"/>`; } }); });
    return s; }
  if(type==='cross') return `<path d="M-13 0h26M0 -13v26" stroke="${col}" stroke-width="1.4"/><circle cx="0" cy="0" r="20" fill="none" stroke="${col}" stroke-width="1.2"/>`;
  return ''; }

const useL=(i,sc,st,ox=0,oy=0)=>`<use href="#${LAY[i].id}" transform="translate(${r2(-st.ax*sc+ox)} ${r2(-st.ay*sc+oy)}) scale(${sc.toFixed(4)})"/>`;
const deg=t=>2*Math.atan(t/1000)*180/Math.PI;

/* geometry that does not depend on the controls: used by the catalog */
function geom(cam){
  if(cam.kind==='slr'){ const fe=(cam.magRef||50)/cam.mag, k=1000/fe, fw=cam.fmt==='half'?9:18; return {W:fw*(cam.covH??cam.cov)*k,H:12*(cam.covV??cam.cov)*k,k,fe}; }
  if(cam.zoom){ const W=1000*18/cam.magRef*cam.mag*cam.fcov; return {W,H:W*2/3,ref:cam.magRef}; }
  if(cam.lens){ const W=1000*18/cam.lens.f*cam.mag*cam.fcov; return {W,H:W*2/3,ref:cam.lens.f}; }
  if(!cam.frames.length) return {W:cam.win.w,H:cam.win.h,ref:50,whole:true};
  let ref=cam.frames[0][0]; cam.frames.flat().forEach(f=>{ if(Math.abs(f-50)<Math.abs(ref-50)) ref=f; });
  const W=1000*18/ref*cam.mag*cam.fcov; return {W,H:W*2/3,ref};
}

function renderSLR(cam,p,st){
  const {W,H,k,fe}=geom(cam), half=cam.fmt==='half', Wf=(half?9:18)*k, Hf=12*k;
  const lens=lensFor(cam,st), f=lens.f, sc=f/fe, ex=exposure(cam,st,lens);
  const Nv=Math.max(st.dof?ex.N:lens.N, cam.scrN||2);
  const b={x0:-W-30,x1:W+30,y0:-H-30,y1:H+30};
  const VW=st.film?Wf:W, VH=st.film?Hf:H; if(st.film){ b.x0=Math.min(b.x0,-Wf-30); b.x1=Math.max(b.x1,Wf+30); b.y0=Math.min(b.y0,-Hf-30); b.y1=Math.max(b.y1,Hf+30); }
  let d=`<clipPath id="${p}cf"><rect x="${r1(-VW)}" y="${r1(-VH)}" width="${r1(2*VW)}" height="${r1(2*VH)}" rx="${st.film?0:5}"/></clipPath>`
       +`<radialGradient id="${p}vg" cx="0" cy="0" r="${r1(Math.hypot(W,H))}" gradientUnits="userSpaceOnUse"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${cam.vig}"/></radialGradient>`;
  let g=`<g clip-path="url(#${p}cf)">`;
  LAY.forEach((L,i)=>{ const cmm=f*f*Math.abs(L.inv-st.u)/(Nv*1000), s=.3*cmm*k;
    if(s>.14){ const m=3*s+4; d+=`<filter id="${p}b${i}" filterUnits="userSpaceOnUse" x="${r1(-VW-m)}" y="${r1(-VH-m)}" width="${r1(2*(VW+m))}" height="${r1(2*(VH+m))}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${r2(s)}"/></filter>`;
      g+=`<g filter="url(#${p}b${i})">${useL(i,sc,st)}</g>`; } else g+=useL(i,sc,st); });
  /* focusing aids: aerial image, so always sharp, displaced by the focus error */
  const off=LAY.map(L=>f*f*(L.inv-st.u)/4500*k/2), rad=mm=>mm*k/2, dark=st.dof&&ex.N>5.7;
  const scr=cam.scr, rS=(scr==='sm'||scr==='split')?rad(3):0, rM=scr==='sm'?rad(5.6):scr==='micro'?rad(4.4):scr==='fullmicro'?rad(7):0;
  if(rM){ const cs=1.7, m=rM+2;
    d+=`<pattern id="${p}pa" width="${2*cs}" height="${2*cs}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${2*cs}" height="${2*cs}" fill="#000"/><rect width="${cs}" height="${cs}" fill="#fff"/><rect x="${cs}" y="${cs}" width="${cs}" height="${cs}" fill="#fff"/></pattern>`
      +`<pattern id="${p}pb" width="${2*cs}" height="${2*cs}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${2*cs}" height="${2*cs}" fill="#000"/><rect x="${cs}" width="${cs}" height="${cs}" fill="#fff"/><rect y="${cs}" width="${cs}" height="${cs}" fill="#fff"/></pattern>`
      +`<mask id="${p}ma" maskUnits="userSpaceOnUse" x="${r1(-m)}" y="${r1(-m)}" width="${r1(2*m)}" height="${r1(2*m)}"><rect x="${r1(-m)}" y="${r1(-m)}" width="${r1(2*m)}" height="${r1(2*m)}" fill="url(#${p}pa)"/></mask>`
      +`<mask id="${p}mb" maskUnits="userSpaceOnUse" x="${r1(-m)}" y="${r1(-m)}" width="${r1(2*m)}" height="${r1(2*m)}"><rect x="${r1(-m)}" y="${r1(-m)}" width="${r1(2*m)}" height="${r1(2*m)}" fill="url(#${p}pb)"/></mask>`
      +`<clipPath id="${p}cm"><circle r="${r1(rM)}"/></clipPath>`;
    g+=`<g clip-path="url(#${p}cm)"><g mask="url(#${p}ma)">${LAY.map((L,i)=>useL(i,sc,st,off[i]*1.3,off[i]*1.3)).join('')}</g><g mask="url(#${p}mb)">${LAY.map((L,i)=>useL(i,sc,st,-off[i]*1.3,-off[i]*1.3)).join('')}</g>`
      +(dark?`<circle r="${r1(rM)}" fill="#000" opacity=".5"/>`:'')+`</g>`; }
  if(rS){ d+=`<clipPath id="${p}ct"><path d="M${r1(-rS)} 0A${r1(rS)} ${r1(rS)} 0 0 1 ${r1(rS)} 0Z"/></clipPath><clipPath id="${p}cb"><path d="M${r1(-rS)} 0A${r1(rS)} ${r1(rS)} 0 0 0 ${r1(rS)} 0Z"/></clipPath>`;
    g+=`<g clip-path="url(#${p}ct)">${LAY.map((L,i)=>useL(i,sc,st,off[i],0)).join('')}${dark?`<rect x="${r1(-rS)}" y="${r1(-rS)}" width="${r1(2*rS)}" height="${r1(rS)}" fill="#000" opacity=".86"/>`:''}</g>`
      +`<g clip-path="url(#${p}cb)">${LAY.map((L,i)=>useL(i,sc,st,-off[i],0)).join('')}</g>`; }
  /* screen brightness: lens speed, stop-down and the screen itself */
  const rel=Math.pow(Math.pow(2/Math.max(Nv,2),2),.28), dim=clamp(1-cam.bright*rel,0,.9);
  g+=`<rect x="${r1(-W)}" y="${r1(-H)}" width="${r1(2*W)}" height="${r1(2*H)}" fill="url(#grain)" opacity="${r2(.5-.38*cam.bright)}"/>`;
  g+=`<rect x="${r1(-W)}" y="${r1(-H)}" width="${r1(2*W)}" height="${r1(2*H)}" fill="#000" opacity="${r2(dim)}"/><rect x="${r1(-W)}" y="${r1(-H)}" width="${r1(2*W)}" height="${r1(2*H)}" fill="url(#${p}vg)"/>`;
  const et='fill="none" stroke="#050505" stroke-opacity=".62" stroke-width="1"';
  if(rM) g+=`<circle r="${r1(rM)}" ${et}/>`;
  if(rS) g+=`<circle r="${r1(rS)}" ${et}/><path d="M${r1(-rS)} 0H${r1(rS)}" ${et}/>`;
  if(cam.ring) g+=`<circle r="${r1(rad(cam.ring))}" ${et}/>`;
  if(cam.spot) g+=`<circle r="${r1(rad(cam.spot))}" ${et}/>`;
  if(cam.rect12) g+=`<rect x="${r1(-6.2*k)}" y="${r1(-4.1*k)}" width="${r1(12.4*k)}" height="${r1(8.2*k)}" fill="#000" opacity=".13"/>`;
  if(cam.af) g+=afMarks(cam.af,k,'rgba(5,5,5,.8)');
  if(st.film) g+=`<path fill-rule="evenodd" d="M${r1(-Wf)} ${r1(-Hf)}H${r1(Wf)}V${r1(Hf)}H${r1(-Wf)}ZM${r1(-W)} ${r1(-H)}V${r1(H)}H${r1(W)}V${r1(-H)}Z" fill="#000" opacity=".5"/><rect x="${r1(-Wf)}" y="${r1(-Hf)}" width="${r1(2*Wf)}" height="${r1(2*Hf)}" fill="none" stroke="#d0aa66" stroke-width="1.6" stroke-dasharray="7 5"/>`;
  g+=`</g>`;
  const dsp=drawDisplays(cam,W,H,ex,p,b,st);
  const notes=[]; if(lens.sub) notes.push(`No ${st.lens} mm equivalent in this system; showing the ${lens.f} mm.`);
  return {inner:`<defs>${d}</defs>${g}${dsp}`,b,sc,ex,lens,notes,W,H};
}

function pickFrames(cam,F){ const tgt=F===85?90:F; let best=null,bd=9,bf=null;
  cam.frames.forEach(set=>set.forEach(f=>{ const dd=Math.abs(Math.log(f/tgt)); if(dd<bd-1e-9){bd=dd;best=set;bf=f;} }));
  return {set:best,f:bf,exact:bd<.09}; }
function frameSVG(hw,hh,cx,cy,F,full){ let dpath;
  if(full){ const r=9; dpath=`M${r1(cx-hw+r)} ${r1(cy-hh)}H${r1(cx+hw-r)}Q${r1(cx+hw)} ${r1(cy-hh)} ${r1(cx+hw)} ${r1(cy-hh+r)}V${r1(cy+hh-r)}Q${r1(cx+hw)} ${r1(cy+hh)} ${r1(cx+hw-r)} ${r1(cy+hh)}H${r1(cx-hw+r)}Q${r1(cx-hw)} ${r1(cy+hh)} ${r1(cx-hw)} ${r1(cy+hh-r)}V${r1(cy-hh+r)}Q${r1(cx-hw)} ${r1(cy-hh)} ${r1(cx-hw+r)} ${r1(cy-hh)}`; }
  else { const s=F<=50?.4:F<=100?.27:.2, lx=hw*2*s, ly=hh*2*s; dpath='';
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{ dpath+=`M${r1(cx+sx*hw)} ${r1(cy+sy*hh-sy*ly)}V${r1(cy+sy*hh)}H${r1(cx+sx*hw-sx*lx)}`; }); }
  return `<path d="${dpath}" fill="none" stroke="#fffbe9" stroke-opacity=".22" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${dpath}" fill="none" stroke="#fffdf2" stroke-opacity=".94" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`; }

function renderRF(cam,p,st){
  const lens=lensFor(cam,st), exLens=(lens.fixed||lens.set)?lens:{f:st.lens,N:LENSES[st.lens]}, ex=exposure(cam,st,exLens), notes=[];
  let mag=cam.mag, W,H, set=[], mine=null;
  if(cam.zoom){ mag=cam.mag*lens.f/cam.magRef; W=1000*18/cam.magRef*cam.mag*cam.fcov; H=W*2/3; if(lens.sub) notes.push(`No ${st.lens} mm lens for this mount; showing the ${lens.f} mm.`); }
  else { W=cam.win.w; H=cam.win.h;
    if(cam.lens){ set=[cam.lens.f]; mine=cam.lens.f; }
    else if(cam.frames.length){ const pk=pickFrames(cam,st.lens); set=pk.set; mine=pk.f;
      if(!pk.exact) notes.push(`No ${st.lens===85?'85–90':st.lens} mm frame in this finder: you would add a shoe-mount finder. Showing the ${pk.f} mm frame.`);
      else if(set.length>1) notes.push(`Frames in view: ${set.join(' + ')} mm. Yours is the ${mine}.`); }
    else if(st.lens!==50) notes.push(`No framelines: the window is about a 50 mm field, so a ${st.lens===85?'85–90':st.lens} mm lens needs a separate finder.`);
  }
  const sc=mag, b={x0:-W-30,x1:W+30,y0:-H-30,y1:H+30};
  let d=`<clipPath id="${p}cw"><rect x="${r1(-W)}" y="${r1(-H)}" width="${r1(2*W)}" height="${r1(2*H)}" rx="${cam.zoom?4:11}"/></clipPath>`
       +`<filter id="${p}eg" filterUnits="userSpaceOnUse" x="${r1(-W-30)}" y="${r1(-H-30)}" width="${r1(2*W+60)}" height="${r1(2*H+60)}"><feGaussianBlur stdDeviation="${cam.zoom?2:7}"/></filter>`;
  let g=`<g clip-path="url(#${p}cw)">`+LAY.map((L,i)=>useL(i,sc,st)).join('');
  if(cam.tint) g+=`<rect x="${r1(-W)}" y="${r1(-H)}" width="${r1(2*W)}" height="${r1(2*H)}" fill="${cam.tint[0]}" opacity="${cam.tint[1]}"/>`;
  g+=`<rect x="${r1(-W)}" y="${r1(-H)}" width="${r1(2*W)}" height="${r1(2*H)}" fill="#fff" opacity=".04"/>`;
  const P=cam.patch;
  if(P&&cam.base){ const tint=P.tint||'#ffffff', m=Math.max(P.w,P.h)+14; let attr;
    if(P.diamond){ d+=`<clipPath id="${p}cp"><path d="M0 ${-P.h}L${P.w} 0L0 ${P.h}L${-P.w} 0Z"/></clipPath>`; attr=`clip-path="url(#${p}cp)"`; }
    else if(P.soft){ d+=`<filter id="${p}sf" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${2*m}" height="${2*m}"><feGaussianBlur stdDeviation="${P.soft}"/></filter><mask id="${p}mp" maskUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${2*m}" height="${2*m}"><rect x="${-P.w}" y="${-P.h}" width="${2*P.w}" height="${2*P.h}" rx="${P.soft*1.5}" fill="#fff" filter="url(#${p}sf)"/></mask>`; attr=`mask="url(#${p}mp)"`; }
    else { d+=`<clipPath id="${p}cp"><rect x="${-P.w}" y="${-P.h}" width="${2*P.w}" height="${2*P.h}" rx="${P.rx||2}"/></clipPath>`; attr=`clip-path="url(#${p}cp)"`; }
    g+=`<g ${attr}><rect x="${-m}" y="${-m}" width="${2*m}" height="${2*m}" fill="${tint}" opacity="${P.tint?.3:.16}"/><g opacity=".5">${LAY.map((L,i)=>useL(i,sc,st,mag*1000*cam.base*(L.inv-st.u),0)).join('')}</g><rect x="${-m}" y="${-m}" width="${2*m}" height="${2*m}" fill="${tint}" opacity="${P.tint?.12:.05}"/></g>`; }
  /* bright-line frames, with parallax shift toward the lens as focus comes closer */
  const px=mag*1000*cam.off.x*st.u, py=mag*1000*cam.off.y*st.u, fx=cam.par==='auto'?px:0, fy=cam.par==='auto'?py:0;
  if(!cam.zoom) set.forEach(F=>{ const hw=1000*18/F*mag*cam.fcov, hh=hw*2/3; g+=frameSVG(hw,hh,fx,fy,F,!!cam.lens);
    if(cam.labels) g+=TX(fx+hw-20,fy+hh-8,F,12,'#fffdf2','middle','opacity=".9"');
    if(cam.par==='marks'){ const mx=mag*1000*cam.off.x*1.1, my=mag*1000*cam.off.y*1.1; g+=`<path d="M${r1(-hw+mx+8)} ${r1(-hh+my)}h34M${r1(-hw+mx)} ${r1(-hh+my+8)}v26" stroke="#fffdf2" stroke-opacity=".9" stroke-width="2" stroke-linecap="round" fill="none"/>`; } });
  if(cam.af) g+=afMarks(cam.af,16,cam.zoom?'rgba(5,5,5,.8)':'#fffdf2');
  if(st.film){ const F=cam.zoom?lens.f:(mine||50), hw=1000*18/F*mag*(1-F*st.u/1000), hh=hw*2/3;
    g+=`<rect x="${r1(px-hw)}" y="${r1(py-hh)}" width="${r1(2*hw)}" height="${r1(2*hh)}" fill="none" stroke="#d0aa66" stroke-width="1.8" stroke-dasharray="7 5"/>`; }
  g+=`<rect x="${r1(-W-6)}" y="${r1(-H-6)}" width="${r1(2*W+12)}" height="${r1(2*H+12)}" rx="14" fill="none" stroke="#000" stroke-width="${cam.zoom?8:22}" filter="url(#${p}eg)"/>`;
  g+=`</g>`+drawDisplays(cam,W,H,ex,p,b,st);
  return {inner:`<defs>${d}</defs>${g}`,b,sc,ex,lens:exLens,notes,W,H,mine};
}
const renderFinder=(cam,p,st)=>cam.kind==='slr'?renderSLR(cam,p,st):renderRF(cam,p,st);
