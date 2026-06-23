// server/routes/push.js
import { Router } from 'express'
import webpush from 'web-push'
import { query } from '../db.js'
import { withAuth } from './auth.js'

const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
let PUB = process.env.VAPID_PUBLIC_KEY || ''
let PRIV = process.env.VAPID_PRIVATE_KEY || ''

if (!PUB || !PRIV) {
  const generated = webpush.generateVAPIDKeys()
  PUB = generated.publicKey
  PRIV = generated.privateKey
}

webpush.setVapidDetails(SUBJECT, PUB, PRIV)

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
}
ensureTable().catch(() => {})

const r = Router()

r.get('/vapidPublicKey', (_req, res) => res.json({ key: PUB }))

r.post('/subscribe', withAuth, async (req, res) => {
  try {
    const sub = req.body || {}
    const endpoint = sub?.endpoint
    const p256dh = sub?.keys?.p256dh
    const auth = sub?.keys?.auth
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'bad_subscription' })

    const rows = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id=excluded.user_id,
         p256dh=excluded.p256dh,
         auth=excluded.auth
       RETURNING id`,
      [req.user.id, endpoint, p256dh, auth]
    )

    res.json({ ok: true, id: rows?.[0]?.id })
  } catch {
    res.status(500).json({ error: 'subscribe_failed' })
  }
})

r.post('/debug/push-now', withAuth, async (req, res) => {
  try {
    const subs = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [req.user.id])
    if (!subs.length) {
      return res.status(404).json({
        ok: false,
        error: 'Нет активных push-подписок. Сначала подключите web push в настройках.',
      })
    }

    const title = String(req.body?.title || 'ГласПлан')
    const body = String(req.body?.body || 'Пуш работает. Это тестовое уведомление.')
    const url = String(req.body?.url || '/')
    const payload = JSON.stringify({ title, body, url })
    const results = []

    for (const s of subs) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      try {
        const resp = await webpush.sendNotification(subscription, payload)
        results.push({ id: s.id, status: resp.statusCode || 201 })
      } catch (err) {
        const code = err?.statusCode || err?.status || 0
        if (code === 404 || code === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {})
          results.push({ id: s.id, status: code, deleted: true })
        } else {
          results.push({ id: s.id, status: code || 'error' })
        }
      }
    }

    res.json({ ok: true, results })
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || 'push_failed' })
  }
})

export default r
