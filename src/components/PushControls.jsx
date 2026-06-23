import { useState } from 'react'
import { emitAppNotification } from './InAppNotifications.jsx'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }
  return output
}

export default function PushControls() {
  const [state, setState] = useState({ type: '', text: '' })
  const [loadingAction, setLoadingAction] = useState('')
  const [diag, setDiag] = useState('')

  async function ensureServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker не поддерживается в этом браузере.')
    }

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    return registration
  }

  const activatePush = async () => {
    setLoadingAction('enable')
    setState({ type: '', text: '' })

    try {
      if (typeof Notification === 'undefined') {
        throw new Error('Notification API недоступен.')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Разрешите уведомления в браузере.')
      }

      const registration = await ensureServiceWorker()
      const vapidRes = await fetch('/api/vapidPublicKey', { credentials: 'include' })
      const { key } = await vapidRes.json()

      if (!key) {
        throw new Error('Публичный VAPID-ключ не настроен.')
      }

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        })
      }

      const response = await fetch('/api/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      if (!response.ok) {
        const txt = await response.text().catch(() => '')
        throw new Error(`Сервер не принял push-подписку (${response.status}). ${txt}`)
      }

      setState({ type: 'success', text: 'Веб-push подключён. Теперь можно отправлять серверный тест.' })
    } catch (error) {
      setState({ type: 'error', text: error.message || 'Не удалось активировать push.' })
    } finally {
      setLoadingAction('')
    }
  }

  const sendTestPush = async () => {
    setLoadingAction('test')
    setState({ type: '', text: '' })

    try {
      const response = await fetch('/api/debug/push-now', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'ГласПлан',
          body: 'Тестовое push-уведомление отправлено с сервера.',
          url: '/',
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Сервер не подтвердил отправку теста (${response.status}).`)
      }

      const details = Array.isArray(payload.results) && payload.results.length
        ? payload.results.map((item) => `#${item.id}: ${item.status}${item.deleted ? ' (удалена)' : ''}`).join(', ')
        : 'подписки не найдены'

      setState({ type: 'success', text: `Серверный push отправлен. ${details}` })
    } catch (error) {
      setState({ type: 'error', text: error.message || 'Тестовый push не отправлен.' })
    } finally {
      setLoadingAction('')
    }
  }

  const showInAppTest = () => {
    emitAppNotification({
      title: 'Внутреннее уведомление',
      body: 'Это локальный тест внутри приложения. Он не зависит от Chrome push или service worker.',
      tone: 'success',
    })
    setState({ type: 'success', text: 'Внутреннее уведомление показано прямо в интерфейсе.' })
  }

  const resubscribePush = async () => {
    setLoadingAction('resubscribe')
    setState({ type: '', text: '' })
    try {
      const registration = await ensureServiceWorker()
      const current = await registration.pushManager.getSubscription()
      if (current) await current.unsubscribe()
      await activatePush()
    } catch (error) {
      setState({ type: 'error', text: error.message || 'Не удалось переподписаться.' })
      setLoadingAction('')
    }
  }

  const runDiagnostics = async () => {
    try {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
      let subState = 'нет service worker'

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = reg ? await reg.pushManager.getSubscription() : null
        subState = sub ? 'подписка есть' : 'подписки нет'
      }

      setDiag(`Поддержка: ${supported ? 'да' : 'нет'} | Разрешение: ${permission} | Состояние: ${subState}`)
    } catch (error) {
      setDiag(`Диагностика не удалась: ${error.message || 'unknown error'}`)
    }
  }

  return (
    <div className="push-controls">
      <div className="push-panel-grid">
        <section className="push-panel">
          <div className="push-panel-copy">
            <span className="push-kicker">Web Push</span>
            <h5>Браузерные уведомления</h5>
            <p>Используйте этот канал, если хотите получать уведомления через Service Worker даже вне активной вкладки.</p>
          </div>
          <div className="push-actions">
            <button type="button" className="btn secondary" onClick={activatePush} disabled={!!loadingAction}>
              {loadingAction === 'enable' ? 'Подключаем...' : 'Активировать push'}
            </button>
            <button type="button" className="btn secondary" onClick={resubscribePush} disabled={!!loadingAction}>
              {loadingAction === 'resubscribe' ? 'Обновляем...' : 'Переподписать push'}
            </button>
            <button type="button" className="btn secondary" onClick={sendTestPush} disabled={!!loadingAction}>
              {loadingAction === 'test' ? 'Отправляем...' : 'Отправить серверный тест'}
            </button>
            <button type="button" className="btn secondary" onClick={runDiagnostics} disabled={!!loadingAction}>
              Проверить окружение
            </button>
          </div>
        </section>

        <section className="push-panel push-panel--app">
          <div className="push-panel-copy">
            <span className="push-kicker">In-App</span>
            <h5>Внутренние уведомления</h5>
            <p>Этот тест работает прямо в интерфейсе и не зависит от поддержки Chrome уведомлений или push-подписки.</p>
          </div>
          <div className="push-actions push-actions--single">
            <button type="button" className="btn" onClick={showInAppTest}>
              Показать внутреннее уведомление
            </button>
          </div>
        </section>
      </div>

      <div className="push-hint">
        Если серверный push не проходит, сначала проверьте разрешение браузера и наличие подписки. Для быстрой проверки интерфейса используйте внутренний канал.
      </div>

      {state.text ? <div className={`push-message ${state.type}`}>{state.text}</div> : null}
      {diag ? <div className="push-message">{diag}</div> : null}
    </div>
  )
}
