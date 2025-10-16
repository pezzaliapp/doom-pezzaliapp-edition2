// app.js — robust loader WAD (locale + freedoom share) + touch overlay + start engine
const canvas             = document.getElementById('screen');
const wadInput           = document.getElementById('wadInput');
const btnShareware       = document.getElementById('loadShareware');
const btnFreedoomLocal   = document.getElementById('btnFreedoomLocal');
const btnStart           = document.getElementById('btnStart');
const banner             = document.getElementById('banner');
const btnInstall         = document.getElementById('btnInstall');

function showWarn(msg){ if (banner){ banner.hidden = false; banner.textContent = msg; } console.log('[WAD]', msg); }
function hideWarn(){ if (banner) banner.hidden = true; }

const hasOPFS = !!(navigator.storage && navigator.storage.getDirectory);

async function saveWad(name, bytes){
  try{
    if (hasOPFS) {
      const root = await navigator.storage.getDirectory();
      const fh = await root.getFileHandle(name, { create:true });
      const w = await fh.createWritable();
      await w.write(bytes);
      await w.close();
    } else {
      const cache = await caches.open('doom-data');
      await cache.put(new Request(name), new Response(new Blob([bytes])));
    }
  }catch(e){ console.warn('[WAD] saveWad fallito:', e); }
}
async function loadWad(name){
  if (hasOPFS) {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(name, { create:false });
    const f = await fh.getFile();
    return new Uint8Array(await f.arrayBuffer());
  } else {
    const cache = await caches.open('doom-data');
    const resp = await cache.match(name);
    if (!resp) throw new Error('WAD non trovato in cache');
    return new Uint8Array(await resp.arrayBuffer());
  }
}

let iwadBuffer = null;

async function fetchBytes(url){
  const bust = url.includes('?') ? `${url}&cb=${Date.now()}` : `${url}?cb=${Date.now()}`;
  const resp = await fetch(bust, { cache: 'no-store', mode: 'cors' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} su ${url}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const len = buf.length;
  console.log('[WAD] scaricato', url, 'bytes=', len);
  if (len < 64 * 1024) throw new Error(`File troppo piccolo (${len} B): controlla URL/Service Worker`);
  return buf;
}

async function startGame(){
  hideWarn();
  if (!iwadBuffer){ showWarn('Carica prima un file WAD (doom1.wad / Freedoom).'); return; }
  if (!window.DoomEngineRunner){
    showWarn('Motore non pronto. Verifica /engine/engine.js e /engine/engine.wasm, poi Hard Reload.');
    return;
  }
  try{
    showWarn('Avvio motore…');
    await window.DoomEngineRunner.start(iwadBuffer);
    hideWarn();
  }catch(e){ console.error(e); showWarn('Errore avvio engine: ' + (e?.message || e)); }
}

wadInput?.addEventListener('change', async e=>{
  const file = e.target.files?.[0];
  if (!file) return;
  try{
    const bytes = new Uint8Array(await file.arrayBuffer());
    iwadBuffer = bytes; // RAM subito
    btnStart.disabled = false;
    showWarn(`WAD locale caricato (${(bytes.length/1048576).toFixed(1)} MB). Premi "Avvia".`);
    saveWad('doom1.wad', bytes).catch(()=>{});
  }catch(err){ console.error(err); showWarn('Errore lettura WAD locale: '+(err?.message||err)); }
});

const LOCAL_FREEDOOM_URL = './freedoom/freedoom1.wad';
async function loadFreedoomLocal(){
  hideWarn();
  try{
    showWarn('Carico Freedoom locale…');
    const bytes = await fetchBytes(LOCAL_FREEDOOM_URL);
    iwadBuffer = bytes;
    btnStart.disabled = false;
    showWarn(`Freedoom locale caricato (${(bytes.length/1048576).toFixed(1)} MB). Premi "Avvia".`);
    saveWad('doom1.wad', bytes).catch(()=>{});
  }catch(e){ console.error(e); showWarn('Impossibile caricare Freedoom locale: ' + (e?.message || e)); }
}
btnFreedoomLocal?.addEventListener('click', loadFreedoomLocal);

btnShareware?.addEventListener('click', async ()=>{
  const urls = [
    'https://github.com/freedoom/freedoom/releases/latest/download/freedoom1.wad',
    'https://freedoom.soulsphere.org/freedoom1.wad',
    'https://archive.org/download/doom-shareware/doom1.wad'
  ];
  let ok = false;
  for (const url of urls){
    try{
      showWarn('Scarico WAD: ' + url);
      const buf = await fetchBytes(url);
      iwadBuffer = buf;
      btnStart.disabled = false;
      showWarn(`WAD scaricato (${(buf.length/1048576).toFixed(1)} MB). Premi "Avvia".`);
      saveWad('doom1.wad', buf).catch(()=>{});
      ok = true; break;
    }catch(e){ console.warn('Download fallito', url, e); }
  }
  if (!ok) showWarn('Impossibile scaricare un WAD shareware. Prova con “Scegli file”.');
});

btnStart?.addEventListener('click', startGame);

// PWA install
let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (btnInstall) btnInstall.hidden = false; });
btnInstall?.addEventListener('click', async ()=>{
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice.catch(()=>{});
  deferred = null;
  if (btnInstall) btnInstall.hidden = true;
});

// Touch overlay
const stickL = document.getElementById('stickL');
const nub = stickL?.querySelector('.nub');
let stickActive = false, center = {x:0,y:0};

function synthKey(code, type='keydown'){ const ev = new KeyboardEvent(type, { code, key: code, bubbles:true }); document.dispatchEvent(ev); }
function updateDirections(vec){
  const dead = 10, {x, y} = vec;
  ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].forEach(k=>synthKey(k,'keyup'));
  if (y < -dead){ synthKey('ArrowUp');  synthKey('KeyW'); }
  if (y >  dead){ synthKey('ArrowDown'); synthKey('KeyS'); }
  if (x < -dead){ synthKey('ArrowLeft'); synthKey('KeyA'); }
  if (x >  dead){ synthKey('ArrowRight'); synthKey('KeyD'); }
}
function handleStart(e){
  const t = (e.touches? e.touches[0]: e);
  const rect = stickL.getBoundingClientRect();
  center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  stickActive = true; handleMove(e);
}
function handleMove(e){
  if (!stickActive) return;
  const t = (e.touches? e.touches[0]: e);
  const dx = t.clientX - center.x, dy = t.clientY - center.y;
  const max = 52;
  const cx = Math.max(-max, Math.min(max, dx));
  const cy = Math.max(-max, Math.min(max, dy));
  if (nub) nub.style.transform = `translate(${cx}px, ${cy}px)`;
  updateDirections({ x: cx, y: cy });
  e.preventDefault();
}
function handleEnd(){
  stickActive = false;
  if (nub) nub.style.transform = 'translate(-50%,-50%)';
  updateDirections({x:0,y:0});
}
if (stickL){
  ['touchstart','mousedown'].forEach(ev=> stickL.addEventListener(ev, handleStart, {passive:false}));
  ['touchmove','mousemove'].forEach	ev=> window.addEventListener(ev, handleMove, {passive:false}));
  ['touchend','touchcancel','mouseup','mouseleave'].forEach(ev=> window.addEventListener(ev, handleEnd));
}
document.querySelectorAll('.btn[data-key]').forEach(b=>{
  const code = b.dataset.key;
  b.addEventListener('touchstart', e=>{ synthKey(code,'keydown'); e.preventDefault(); });
  b.addEventListener('touchend',   e=>{ synthKey(code,'keyup');   e.preventDefault(); });
  b.addEventListener('mousedown',  ()=> synthKey(code,'keydown'));
  b.addEventListener('mouseup',    ()=> synthKey(code,'keyup'));
});

showWarn('Pronto. Carica un WAD locale, oppure “Usa Freedoom locale / share”, poi Avvia.');
