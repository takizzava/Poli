import { useEffect, useState } from 'react'

const MAX_ITEMS = 4
const DEFAULT_TIMEOUT = 5000

export function emitAppNotification(notification) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent('app-notify', {
      detail: {
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tone: 'info',
        timeoutMs: DEFAULT_TIMEOUT,
        ...notification,
      },
    })
  )
}

export default function InAppNotifications() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const timers = new Map()

    const remove = (id) => {
      setItems((current) => current.filter((item) => item.id !== id))
      const timer = timers.get(id)
      if (timer) {
        window.clearTimeout(timer)
        timers.delete(id)
      }
    }

    const push = (payload) => {
      if (!payload?.title && !payload?.body) return

      const item = {
        id: payload.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: payload.title || 'Уведомление',
        body: payload.body || '',
        tone: payload.tone || 'info',
        timeoutMs: payload.timeoutMs ?? DEFAULT_TIMEOUT,
      }

      setItems((current) => [item, ...current].slice(0, MAX_ITEMS))

      const timer = window.setTimeout(() => remove(item.id), item.timeoutMs)
      timers.set(item.id, timer)
    }

    const onNotify = (event) => push(event.detail)
    const onWorkerMessage = (event) => {
      if (event.data?.type !== 'edi-push') return
      push({
        title: event.data?.data?.title || 'Push уведомление',
        body: event.data?.data?.body || 'Получено новое сообщение.',
        tone: 'success',
      })
    }

    window.addEventListener('app-notify', onNotify)
    navigator.serviceWorker?.addEventListener?.('message', onWorkerMessage)

    return () => {
      window.removeEventListener('app-notify', onNotify)
      navigator.serviceWorker?.removeEventListener?.('message', onWorkerMessage)
      for (const timer of timers.values()) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  if (!items.length) return null

  return (
    <aside className="app-notify-stack" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <article key={item.id} className={`app-notify app-notify--${item.tone}`}>
          <strong>{item.title}</strong>
          {item.body ? <p>{item.body}</p> : null}
        </article>
      ))}
    </aside>
  )
}
