const V='botw-yemek-v4';
const CORE=['./','index.html','scan-core.js','tarama.webp','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const page=r.mode==='navigate'||/\/(index\.html)?$/.test(new URL(r.url).pathname)||/scan-core\.js$/.test(r.url);
  e.respondWith(caches.open(V).then(async c=>{
    const hit=await c.match(r,{ignoreSearch:true});
    const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res});
    if(page)return Promise.race([net,new Promise((_,no)=>setTimeout(no,3500))]).catch(()=>hit||net);
    net.catch(()=>{});return hit||net;
  }));
});
