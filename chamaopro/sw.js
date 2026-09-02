self.addEventListener('install',()=>{
  self.skipWaiting();
});

self.addEventListener('activate',(event)=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick',(event)=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find((client)=>client.url.includes('/Site/chamaopro/'));
    if(existing){
      await existing.focus();
      return;
    }
    await self.clients.openWindow(self.registration.scope);
  })());
});
