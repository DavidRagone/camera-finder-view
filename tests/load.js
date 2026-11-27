'use strict';
/* Loads the page's classic scripts into one vm context, so they share globals the way they do in the browser.
   load() gives the catalog and the renderers. load({app:true}) also runs app.js against a stand-in DOM: each
   selector gets one element that remembers what it was given, and fire() calls the listeners app.js attached. */
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const ROOT=path.join(__dirname,'..');

function standInDom(){
  const els=new Map();
  const el=sel=>{
    if(!els.has(sel)){ const on={}, attrs={};
      els.set(sel,{innerHTML:'',textContent:'',value:'',checked:false,dataset:{},classList:{toggle(){},add(){},remove(){}},
        addEventListener(type,fn){ (on[type]??=[]).push(fn); }, fire(type,ev={}){ (on[type]||[]).forEach(fn=>fn(ev)); },
        setAttribute(k,v){ attrs[k]=String(v); }, getAttribute:k=>attrs[k], querySelector:s=>el(s), querySelectorAll:()=>[]}); }
    return els.get(sel); };
  return el;
}

function load({app=false,stored=null}={}){
  const el=standInDom(), store={'vf-state':stored?JSON.stringify(stored):null};
  const ctx=vm.createContext({console,
    document:{querySelector:el, querySelectorAll:()=>[], getElementById:id=>el('#'+id), createElement(){ throw new Error('no canvas in the stand-in DOM'); }},
    window:{addEventListener(){}}, localStorage:{getItem:k=>store[k]??null, setItem(k,v){ store[k]=v; }},
    requestAnimationFrame:fn=>fn(), setTimeout:()=>0, clearTimeout(){}});
  for(const f of ['scene.js','data.js','render.js',...(app?['app.js']:[])])
    vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'),ctx,{filename:'js/'+f});
  const names='CAMERAS,CAM,SOURCES,D,DS,LED,fold,geom,renderFinder'+(app?',st':'');
  return Object.assign(vm.runInContext(`({${names}})`,ctx),{el});
}
module.exports={load,ROOT};
