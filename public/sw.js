self.addEventListener('install', (e) => self.skipWaiting())
self.addEventListener('activate', (e) => self.clients.claim())

self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data.json() } catch {}
  const title = data.title || 'Поли'
  const body = data.body || 'Уведомление'
  e.waitUntil(self.registration.showNotification(title, { body }))
  e.waitUntil((async () => {
    const pages = await clients.matchAll({ type:'window', includeUncontrolled:true })
    pages.forEach(p => p.postMessage({ type:'edi-push', data }))
  })())
})
