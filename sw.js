// Version bei jeder Veröffentlichung gemeinsam mit app.js erhöhen.
const VERSION='1.0.1';
const CACHE='percare-test-shell-'+VERSION;
const ASSETS=['./','./index.html','./style.css','./app.js','./backup.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('percare-test-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request)));});
