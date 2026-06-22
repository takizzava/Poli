// server/routes/external.js
import { Router } from 'express'
import { query } from '../db.js'
import { randomUUID } from 'crypto'

const r = Router()

async function tokenAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const apiKey = header.startsWith('Bearer ') ? header.slice(7) : (req.headers['x-api-key'] || '')
    if (!apiKey) return res.status(401).json({ error: 'api_key_required' })

    const rows = await query('select user_id from api_tokens where token=$1 limit 1', [apiKey])
    const row = rows[0]
    if (!row) return res.status(401).json({ error: 'invalid_api_key' })

    query("update api_tokens set last_used_at=datetime('now') where token=$1", [apiKey]).catch(() => {})
    req.userId = row.user_id
    next()
  } catch {
    res.status(500).json({ error: 'auth_failed' })
  }
}

r.post('/ext/reminders', tokenAuth, async (req, res) => {
  try {
    const { text, due } = req.body || {}
    const clean = String(text || '').trim()
    const dueMs = Number(due)
    if (!clean || clean.length < 1 || clean.length > 1000) return res.status(400).json({ error: 'text_invalid' })
    if (!Number.isFinite(dueMs)) return res.status(400).json({ error: 'due_invalid' })

    const now = Date.now()
    if (dueMs < now - 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'too_old' })
    if (dueMs - now > 365 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'too_far' })

    const id = randomUUID()
    const rows = await query(
      `insert into reminders(id, user_id, text, due, status)
       values ($1,$2,$3,datetime($4/1000, 'unixepoch'),'pending')
       returning id, text, cast(strftime('%s', due) as integer)*1000 as due, status`,
      [id, req.userId, clean, dueMs]
    )

    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'create_failed' })
  }
})

r.get('/ext/reminders', tokenAuth, async (req, res) => {
  try {
    const rows = await query(
      `select id, text, cast(strftime('%s', due) as integer)*1000 as due, status
         from reminders
        where user_id = $1 and due >= datetime('now','-1 day')
        order by due asc
        limit 200`,
      [req.userId]
    )

    res.json(rows || [])
  } catch {
    res.status(500).json({ error: 'list_failed' })
  }
})

export default r
