'use strict';
/* scene.js: the street scene every finder looks at, built as four SVG depth layers. */
/* ------------------------------------------------------------------
   SCENE. Units are 1000 x tan(angle) from the camera's optical axis,
   eye level at y = 0, camera 1.5 m above a pavement. Four depth layers.
   ------------------------------------------------------------------ */
const LAY = [
  {id:'Lfar', inv:1/60, name:'houses'},
  {id:'Lmid', inv:1/7,  name:'kerb'},
  {id:'Lsub', inv:1/4,  name:'photographer'},
  {id:'Lfg',  inv:1/2.5,name:'hydrant'}
];
function buildScene(){
  const far=[], mid=[], sub=[], fg=[];
  const R=(x,y,w,h,f,ex='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${ex}/>`;

  /* ---- far: sky, hills, street, houses across the road (35 m) ---- */
  far.push(R(-1700,-1300,3400,1360,'url(#gSky)'));
  [[-760,-560,270,34],[-140,-690,360,30],[560,-500,300,32],[1040,-720,230,24],[-1240,-400,210,20],[240,-360,260,16],[-420,-860,300,26],[820,-940,340,28]]
    .forEach(([x,y,rx,ry])=>far.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".6"/>`));
  far.push(`<path d="M-1700 30V-70Q-1250 -170 -820 -92T-160 -58T420 -112T1040 -52T1700 -84V30Z" fill="#8ea4ad"/>`);
  far.push(`<path d="M455 -108V-250M441 -108L455 -214L469 -108M446 -160H464M449 -190H461" stroke="#6f858e" stroke-width="3" fill="none"/>`);
  far.push(R(-1700,-26,3400,60,'#b9c9cc','opacity=".75"'));           // sea haze
  far.push(R(-1700,40,3400,1000,'url(#gRoad)'));
  far.push(`<path d="M-1700 86H1700" stroke="#d8b64c" stroke-width="5" stroke-dasharray="110 70"/>`);
  far.push(R(-1700,42,3400,10,'#b9b4a7'));
  const cols=['#e7c8a0','#b8d2c1','#efe2b3','#c8b9d5','#e5aaa0','#aac6dc','#f1eee5','#d6c3a2','#9fc4b7','#eeb87c','#c9d6a8','#e2d0c0','#b7c0d8'];
  const hs=[196,214,188,206,222,190,204,216,194,210,186,220,200];
  let hx=-1420, n=0;
  while(hx<1420){
    const w=200+(n%3)*12, h=hs[n%13], c=cols[(n*5+2)%13], y0=43-h;
    if(n===8){ hx+=128; n++; continue; }                               // cross street: a gap to the horizon
    let g=R(hx,y0,w,h,c)+R(hx,y0,6,h,'#000','opacity=".13"')+R(hx+w-3,y0,3,h,'#fff','opacity=".25"');
    if(n%3===1) g+=`<path d="M${hx-4} ${y0}L${hx+w/2} ${y0-44}L${hx+w+4} ${y0}Z" fill="#7a5a4a"/><path d="M${hx+10} ${y0}L${hx+w/2} ${y0-34}L${hx+w-10} ${y0}Z" fill="${c}"/>`;
    else if(n%3===2) g+=`<path d="M${hx} ${y0}V${y0-10}Q${hx+w/2} ${y0-40} ${hx+w} ${y0-10}V${y0}Z" fill="${c}"/>`+R(hx-3,y0-3,w+6,7,'#f4f1ea');
    else g+=R(hx-4,y0-9,w+8,11,'#f4f1ea')+R(hx-4,y0+2,w+8,3,'#000','opacity=".18"');
    // picture window (upper floor)
    const wx=hx+w*.12, ww=w*.6, wy=y0+30;
    g+=R(wx-4,wy-4,ww+8,62,'#f4f1ea')+R(wx,wy,ww,54,'#2f4352')+R(wx,wy,ww,20,'#6f8ea3','opacity=".55"')
      +`<path d="M${wx+ww*.26} ${wy}v54M${wx+ww*.74} ${wy}v54" stroke="#f4f1ea" stroke-width="3.2"/>`;
    g+=R(hx+w*.80,wy+6,w*.11,40,'#f4f1ea')+R(hx+w*.80+3,wy+9,w*.11-6,34,'#2f4352');
    // garage + tunnel entry
    const gx=hx+w*.10, gw=w*.44;
    g+=R(gx-3,43-66,gw+6,66,'#f4f1ea')+R(gx,43-62,gw,62,'#6d6b66')
      +`<path d="M${gx} ${43-46}h${gw}M${gx} ${43-31}h${gw}M${gx} ${43-16}h${gw}" stroke="#55534f" stroke-width="2"/>`;
    const ex=hx+w*.66, ew=w*.2;
    g+=`<path d="M${ex} 43V${43-64}Q${ex+ew/2} ${43-86} ${ex+ew} ${43-64}V43Z" fill="#37322d"/>`
      +`<path d="M${ex+2} 43h${ew-4}M${ex+4} 37h${ew-8}M${ex+6} 31h${ew-12}" stroke="#8c867a" stroke-width="2.4"/>`;
    far.push(g); hx+=w; n++;
  }
  // utility poles and wires in front of the houses
  [-565,705].forEach(x=>far.push(R(x-4,-345,8,392,'#4d4238')+R(x-34,-326,68,6,'#4d4238')+R(x-22,-300,44,5,'#4d4238')));
  ['M-1700 -296Q-1130 -246 -565 -322Q70 -238 705 -322Q1200 -252 1700 -300','M-1700 -276Q-1130 -226 -565 -298Q70 -214 705 -298Q1200 -232 1700 -280','M-565 -322Q-250 -150 -180 -120']
    .forEach(d=>far.push(`<path d="${d}" stroke="#24262a" stroke-width="1.7" fill="none"/>`));

  /* ---- mid: near kerb, pavement, parked car, sign, street tree (6-8 m) ---- */
  mid.push(R(-1700,222,3400,12,'#8d897e')+R(-1700,231,3400,800,'#bcb7aa')+R(-1700,231,3400,3,'#d6d2c6'));
  [273,333,429,556,714].forEach((y,i)=>mid.push(`<path d="M-1700 ${y}H1700" stroke="#9f9a8d" stroke-width="${2+i*1.1}"/>`));
  for(let k=-9;k<=9;k++){ if(!k) continue; const x1=k*88; mid.push(`<path d="M${x1} 231L${x1*4.1} 947" stroke="#a6a194" stroke-width="2.2"/>`); }
  // car: 7.6 m away, about 132 units per metre
  { const x0=-900,x1=-340,gy=197;
    mid.push(`<ellipse cx="${(x0+x1)/2}" cy="${gy+2}" rx="${(x1-x0)/2+10}" ry="10" fill="#000" opacity=".28"/>`);
    mid.push(`<path d="M${x0+8} ${gy-22}Q${x0-4} ${gy-60} ${x0+14} ${gy-98}L${x0+96} ${gy-106}L${x0+168} ${gy-186}Q${x0+178} ${gy-192} ${x0+196} ${gy-192}H${x1-176}Q${x1-158} ${gy-192} ${x1-144} ${gy-182}L${x1-66} ${gy-108}L${x1-10} ${gy-92}Q${x1+6} ${gy-60} ${x1-6} ${gy-22}Z" fill="#c2523b"/>`);
    mid.push(`<path d="M${x0+112} ${gy-108}L${x0+174} ${gy-178}H${x0+268}V${gy-108}Z" fill="#26343f"/><path d="M${x0+280} ${gy-178}H${x1-180}L${x1-88} ${gy-108}H${x0+280}Z" fill="#26343f"/>`);
    mid.push(`<path d="M${x0+124} ${gy-110}L${x0+178} ${gy-172}H${x0+220}L${x0+170} ${gy-110}Z" fill="#fff" opacity=".2"/>`);
    mid.push(`<path d="M${x0+10} ${gy-66}H${x1-4}" stroke="#8f3524" stroke-width="3"/><path d="M${x0+274} ${gy-184}V${gy-28}" stroke="#8f3524" stroke-width="2.4"/>`);
    mid.push(R(x0+4,gy-36,x1-x0-8,14,'#2a2a2c')+R(x0-2,gy-92,12,20,'#f3d9a0')+R(x1-10,gy-90,12,22,'#a31f1a'));
    [x0+112,x1-116].forEach(cx=>mid.push(`<circle cx="${cx}" cy="${gy-38}" r="42" fill="#1c1c1e"/><circle cx="${cx}" cy="${gy-38}" r="23" fill="#b9bcc0"/><circle cx="${cx}" cy="${gy-38}" r="8" fill="#55585c"/>`));
  }
  // parking sign, 6.2 m, 161 units per metre
  mid.push(R(165,-246,10,490,'#7d8388')+R(165,-246,3,490,'#fff','opacity=".3"'));
  mid.push(R(144,-236,52,74,'#f2f2ec')+R(144,-236,52,74,'none','stroke="#2f7d4f" stroke-width="5"')+
    `<path d="M156 -214h28M156 -200h28M156 -186h18" stroke="#2f7d4f" stroke-width="5"/>`);
  mid.push(R(146,-150,48,48,'#f2f2ec')+`<circle cx="170" cy="-126" r="17" fill="none" stroke="#c1272d" stroke-width="5"/><path d="M158 -138L182 -114" stroke="#c1272d" stroke-width="5"/>`);
  // street tree at the kerb, 5.8 m
  mid.push(R(598,-200,44,462,'#5b4636')+R(598,-200,12,462,'#000','opacity=".2"')+R(580,252,80,12,'#6f6a5f'));
  [[620,-470,210,'#35543a'],[500,-380,150,'#3f6241'],[760,-400,160,'#3a5b3c'],[640,-640,170,'#44693f'],[540,-560,130,'#507a48'],[730,-560,120,'#4a7143'],[610,-330,120,'#476c44'],[690,-700,90,'#5a864f']]
    .forEach(([x,y,r,c])=>mid.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`));
  [[560,-600,34],[690,-470,40],[470,-430,26],[770,-520,30],[620,-720,24]].forEach(([x,y,r])=>mid.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#7fa864" opacity=".55"/>`));

  /* ---- subject: a photographer 4 m away, 250 units per metre ---- */
  sub.push(`<ellipse cx="6" cy="376" rx="92" ry="11" fill="#000" opacity=".3"/>`);
  sub.push(R(-45,160,40,200,'#463d36','rx="9"')+R(5,160,40,200,'#3f3731','rx="9"'));               // legs
  sub.push(R(-52,350,50,26,'#efece3','rx="10"')+R(2,350,50,26,'#efece3','rx="10"'));               // shoes
  sub.push(`<path d="M-58 22Q-62 8 -40 4L40 4Q62 8 58 22L52 172H-52Z" fill="#23344e"/>`);            // jacket
  sub.push(R(-13,4,26,168,'#efe6d2'));                                                             // shirt
  sub.push(`<path d="M-13 4V172M13 4V172" stroke="#101a2a" stroke-width="2.6"/>`);
  sub.push(`<path d="M-58 24Q-78 34 -76 70L-70 150Q-68 164 -56 162L-42 160L-46 60Z" fill="#1c2b42"/><path d="M58 24Q78 34 76 70L70 150Q68 164 56 162L42 160L46 60Z" fill="#1c2b42"/>`);
  sub.push(`<path d="M-42 150Q-30 132 -16 100" stroke="#c48e69" stroke-width="15" stroke-linecap="round" fill="none"/><path d="M42 150Q30 132 16 100" stroke="#c48e69" stroke-width="15" stroke-linecap="round" fill="none"/>`);
  sub.push(R(-10,-6,20,22,'#b98260'));                                                             // neck
  sub.push(`<path d="M-9 6L-15 60M9 6L15 60" stroke="#0c0c0c" stroke-width="3.4" fill="none"/>`);    // strap
  sub.push(`<ellipse cx="0" cy="-28" rx="24" ry="29" fill="#c9926c"/>`);
  sub.push(`<path d="M-25 -30Q-28 -62 0 -62Q28 -62 25 -30Q20 -46 0 -47Q-20 -46 -25 -30Z" fill="#2a211c"/>`);
  sub.push(`<path d="M-10 -24h6M4 -24h6" stroke="#3a2a22" stroke-width="2.4" stroke-linecap="round"/><path d="M-6 -11Q0 -7 6 -11" stroke="#8a5a45" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  // the camera they are holding: plenty of hard vertical edges right where you focus
  sub.push(R(-25,58,50,31,'#151515','rx="3"')+R(-25,58,50,8,'#d9d9d4','rx="2"')+R(-8,50,16,10,'#d9d9d4','rx="2"'));
  sub.push(`<circle cx="0" cy="76" r="12.5" fill="#2b2b2b" stroke="#d9d9d4" stroke-width="2"/><circle cx="0" cy="76" r="6.5" fill="#39506a"/><circle cx="-2.4" cy="73.6" r="2" fill="#cfe2f5"/>`);
  sub.push(R(13,61,7,3,'#151515')+R(-21,61,5,3,'#b3261e'));

  /* ---- foreground: hydrant at 2.5 m, 400 units per metre ---- */
  fg.push(`<ellipse cx="-486" cy="604" rx="94" ry="13" fill="#000" opacity=".3"/>`);
  fg.push(R(-536,570,100,34,'#d9d2bb','rx="4"')+R(-524,352,76,222,'#e8e1ca')+R(-524,352,18,222,'#fff','opacity=".35"')+R(-466,352,18,222,'#000','opacity=".12"'));
  fg.push(`<path d="M-530 352Q-530 300 -486 296Q-442 300 -442 352Z" fill="#3f6ea8"/>`+R(-496,278,20,22,'#365f92','rx="3"')+R(-534,348,96,10,'#365f92','rx="3"'));
  fg.push(R(-566,410,46,44,'#3f6ea8','rx="6"')+R(-452,410,46,44,'#3f6ea8','rx="6"')+`<circle cx="-486" cy="470" r="24" fill="#3f6ea8"/><circle cx="-486" cy="470" r="9" fill="#2c4d78"/>`);

  const grads=`<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f86b6"/><stop offset=".62" stop-color="#9cc0d6"/><stop offset="1" stop-color="#dfe8e6"/></linearGradient>
  <linearGradient id="gRoad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a6d72"/><stop offset=".25" stop-color="#53565b"/><stop offset="1" stop-color="#45484d"/></linearGradient>`;
  // ground-glass grain: a small noise tile, used as a pattern over SLR screens
  let grain='';
  try{ const cv=document.createElement('canvas'); cv.width=cv.height=128; const cx=cv.getContext('2d'), im=cx.createImageData(128,128); let seed=7;
    for(let i=0;i<im.data.length;i+=4){ seed=(seed*1664525+1013904223)>>>0; const v=(seed>>>24)>127?255:0; im.data[i]=im.data[i+1]=im.data[i+2]=v; im.data[i+3]=((seed>>>9)&127); }
    cx.putImageData(im,0,0); grain=`<pattern id="grain" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${cv.toDataURL()}" width="128" height="128"/></pattern>`; }catch(e){ grain='<pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse"></pattern>'; }
  document.getElementById('sceneDefs').innerHTML = grads + grain +
    `<g id="Lfar">${far.join('')}</g><g id="Lmid">${mid.join('')}</g><g id="Lsub">${sub.join('')}</g><g id="Lfg">${fg.join('')}</g>`;
}
