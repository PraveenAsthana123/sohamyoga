const CACHE='soham-shell-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/catalog','/membership','/contact']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/'))))});

// ── Web Push ─────────────────────────────────────────────────────────────────
// Real push event handling -- receives a JSON payload sent server-side via
// web-push's sendNotification() using self-generated VAPID keys (no
// third-party push provider). Payload shape: { title, body, url, tag, icon }.
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch(e){data={body:event.data?event.data.text():''};}
  const title=data.title||'SohamYoga';
  const options={
    body:data.body||'',
    icon:data.icon||'/push-icon-192.png',
    badge:data.badge||'/push-icon-192.png',
    tag:data.tag||'soham-notification',
    data:{url:data.url||'/'},
    renotify:Boolean(data.tag),
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

// Re-subscribe when the push service invalidates the current subscription
// (key rotation, browser-side expiry, etc.) so the user silently keeps
// receiving pushes instead of going dark until they happen to revisit a
// page that calls subscribe() again. Reuses event.oldSubscription.options
// (same applicationServerKey/VAPID key as the original subscribe call) --
// per the Push API spec this is preserved on the old subscription, so the
// service worker never needs its own copy of the VAPID public key.
self.addEventListener('pushsubscriptionchange',event=>{
  event.waitUntil((async()=>{
    const oldEndpoint=event.oldSubscription?event.oldSubscription.endpoint:null;
    try{
      const newSubscription=await self.registration.pushManager.subscribe(
        event.oldSubscription?event.oldSubscription.options:{userVisibleOnly:true}
      );
      const json=newSubscription.toJSON();
      await fetch('/api/customer/push-subscriptions',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({endpoint:json.endpoint,keys:json.keys}),
      });
      if(oldEndpoint&&oldEndpoint!==json.endpoint){
        await fetch(`/api/customer/push-subscriptions?endpoint=${encodeURIComponent(oldEndpoint)}`,{method:'DELETE'}).catch(()=>{});
      }
    }catch(e){
      // Nothing more this worker can do without a signed-in session context;
      // the stale row is cleaned up server-side the next time a real send
      // to it 404s/410s (see sendPushToUser in src/lib/web-push.ts).
    }
  })());
});

// Focus an already-open tab on the target URL if one exists, otherwise open
// a new one. Clicking the notification also dismisses it.
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const targetUrl=(event.notification.data&&event.notification.data.url)||'/';
  event.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(windowClients=>{
      for(const client of windowClients){
        try{
          const clientUrl=new URL(client.url);
          if(clientUrl.pathname===new URL(targetUrl,self.location.origin).pathname&&'focus'in client){
            return client.focus();
          }
        }catch(e){/* ignore malformed URL, fall through to openWindow */}
      }
      if(clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
