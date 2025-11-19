function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i)
  return out
}

export default function PushControls(){
  async function ensureSW(){
    if (!('serviceWorker' in navigator)) throw new Error('SW не поддерживается')
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    return reg
  }

  return (
    <div className="row" style={{justifyContent:'center'}}>
      <button className="btn secondary" onClick={async ()=>{
        try{
          if (typeof Notification === 'undefined') throw new Error('Notification API не поддерживается')
          const perm = await Notification.requestPermission()
          if (perm !== 'granted') throw new Error('Разрешите уведомления')
          const reg = await ensureSW()
          const { key } = await fetch('/api/vapidPublicKey', { credentials:'include' }).then(r=>r.json())
          if (!key) throw new Error('VAPID ключ не настроен на сервере')
          let sub = await reg.pushManager.getSubscription()
          if (!sub){
            sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(key) })
          }
          const ok = await fetch('/api/subscribe', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(sub) })
          if (!ok.ok) throw new Error('Сервер не принял подписку')
          alert('Подписка активна')
        }catch(e){ alert(e.message||String(e)) }
      }}>Включить уведомления</button>
      <button className="btn secondary" onClick={async ()=>{
        try{
          const r = await fetch('/api/debug/push-now', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ body:'Это тестовый пуш от сервера' }) })
          const j = await r.json()
          alert(j.ok ? 'Пуш отправлен' : 'Ошибка')
        }catch(e){ alert('Ошибка теста: '+(e.message||e)) }
      }}>Тестовый push</button>
    </div>
  )
}
