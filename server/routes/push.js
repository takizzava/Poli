// server/routes/push.js
import { Router } from 'express'
import webpush from 'web-push'
import { query } from '../db.js'
import { withAuth } from './auth.js'

// --------- VAPID INIT ----------
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
let PUB = process.env.VAPID_PUBLIC_KEY || 'BI-yBtxLfibsMvNFxDeUqB1aGQ5oveGZ0wXa1tPmkKSq4RMslqEll9yyXFacAnwV4Pk12bMYK9PvZy3sorh5uFs'
let PRIV = process.env.VAPID_PRIVATE_KEY || 'v1nZ88Neo5s4-1yqsVVcNDtrz3wXLyECbOSKLxLgAVY'

if (!PUB || !PRIV) {
  // генерим одноразовые ключи, чтобы локально всё работало «из коробки»
  const gen = webpush.generateVAPIDKeys()
  PUB = gen.publicKey
  PRIV = gen.privateKey
  console.log('[push] VAPID keys generated (ephemeral for dev)')
}

webpush.setVapidDetails(SUBJECT, PUB, PRIV)
console.log('[push] VAPID keys initialized')

// --------- DB ENSURE ----------
async function ensureTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)
  } catch (e) {
    console.error('[push] ensureTable failed:', e?.message || e)
  }
}
ensureTable()

const r = Router()

// Публичный ключ для браузера
r.get('/vapidPublicKey', (_req, res) => {
  try {
    return res.json({ key: PUB })
  } catch (e) {
    console.error('[push] /vapidPublicKey', e?.message || e)
    return res.status(500).json({ error: 'vapid_failed' })
  }
})

// Сохранение подписки (требует авторизации)
r.post('/subscribe', withAuth, async (req, res) => {
  try {
    const sub = req.body || {}
    const endpoint = sub?.endpoint
    const p256dh = sub?.keys?.p256dh
    const auth = sub?.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'bad_subscription' })
    }

    // upsert по endpoint
    const rows = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
       RETURNING id`,
      [req.user.id, endpoint, p256dh, auth]
    )
    const row = rows && rows[0]
    return res.json({ ok: true, id: row?.id })
  } catch (e) {
    console.error('[push] /subscribe', e?.message || e)
    return res.status(500).json({ error: 'subscribe_failed' })
  }
})

// Отправить тестовый пуш сразу (требует авторизации)
r.post('/debug/push-now', withAuth, async (req, res) => {
  try {
    const subs = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [req.user.id]
    )
    if (!subs || subs.length === 0) {
      return res.status(404).json({ error: 'no_subscriptions' })
    }

    const payload = JSON.stringify({
      title: 'Поли',
      body: 'Пуш работает! Это тестовое уведомление.',
      url: '/' // куда открыть при клике
    })

    const results = []
    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth }
      }
      try {
        const resp = await webpush.sendNotification(subscription, payload)
        results.push({ id: s.id, status: resp.statusCode || 201 })
      } catch (err) {
        // 404/410 — подписка умерла, удаляем
        const code = err?.statusCode || err?.status || 0
        if (code === 404 || code === 410) {
          try {
            await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id])
          } catch {}
          results.push({ id: s.id, status: code, deleted: true })
        } else {
          results.push({ id: s.id, status: code || 'error' })
          console.error('[push] sendNotification failed:', code, err?.message || err)
        }
      }
    }

    return res.json({ ok: true, results })
  } catch (e) {
    console.error('[push] /debug/push-now', e?.message || e)
    return res.status(500).json({ error: 'push_failed' })
  }
})

export default r
