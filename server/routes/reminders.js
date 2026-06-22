// server/routes/reminders.js
import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'
import { randomUUID } from 'crypto'
import { scheduleReminder, cancelReminder } from '../scheduler.js'

const r = Router()
r.use(withAuth)

r.get('/reminders', async (req, res) => {
  try {
    const rows = await query(
      `select id, text, cast(strftime('%s', due) as integer)*1000 as due
         from reminders
        where user_id = $1
        order by due asc`,
      [req.user.id]
    )
    res.json(rows || [])
  } catch {
    res.status(500).json({ error: 'list failed' })
  }
})

r.post('/reminders', async (req, res) => {
  try {
    const { text, due } = req.body || {}
    const dueMs = Number(due)
    const clean = String(text || '').trim()

    if (!clean || clean.length > 1000) return res.status(400).json({ error: 'text must be 1-1000 characters' })
    if (!Number.isFinite(dueMs)) return res.status(400).json({ error: 'due must be a valid timestamp' })

    const dueDate = new Date(dueMs)
    const now = Date.now()
    const maxFuture = now + 365 * 24 * 60 * 60 * 1000
    if (dueDate.getTime() < now - 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'due date cannot be more than 24h in the past' })
    if (dueDate.getTime() > maxFuture) return res.status(400).json({ error: 'due date cannot be more than 1 year in the future' })

    const existing = await query(
      `SELECT id FROM reminders
       WHERE user_id = $1
         AND text = $2
         AND ABS((cast(strftime('%s', due) as integer)*1000) - $3) < 300000
       LIMIT 1`,
      [req.user.id, clean, dueMs]
    )

    if (existing.length > 0) return res.status(409).json({ error: 'duplicate', existing: existing[0], message: 'Similar reminder already exists' })

    const id = randomUUID()
    const rows = await query(
      `insert into reminders(id, user_id, text, due, status)
       values ($1,$2,$3,datetime($4/1000, 'unixepoch'),'pending')
       returning id, user_id, text, cast(strftime('%s', due) as integer)*1000 as due, status`,
      [id, req.user.id, clean, dueMs]
    )

    const reminder = rows[0]
    if (reminder && new Date(reminder.due).getTime() > Date.now()) {
      await scheduleReminder(reminder).catch(() => {})
    }

    res.json(reminder)
  } catch {
    res.status(500).json({ error: 'create failed' })
  }
})

r.delete('/reminders/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '')
    cancelReminder(id)

    const rows = await query(`delete from reminders where id=$1 and user_id=$2 returning id`, [id, req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json({ ok: true, id })
  } catch {
    res.status(500).json({ error: 'delete failed' })
  }
})

r.put('/reminders/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '')
    const { text, due } = req.body || {}
    const dueMs = Number(due)
    const clean = String(text || '').trim()

    if (!clean || clean.length > 1000) return res.status(400).json({ error: 'text must be 1-1000 characters' })
    if (!Number.isFinite(dueMs)) return res.status(400).json({ error: 'due must be a valid timestamp' })

    const dueDate = new Date(dueMs)
    const now = Date.now()
    const maxFuture = now + 365 * 24 * 60 * 60 * 1000
    if (dueDate.getTime() < now - 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'due date cannot be more than 24h in the past' })
    if (dueDate.getTime() > maxFuture) return res.status(400).json({ error: 'due date cannot be more than 1 year in the future' })

    cancelReminder(id)

    const rows = await query(
      `update reminders
          set text=$1,
              due=datetime($2/1000, 'unixepoch'),
              status='pending',
              sent_at=NULL
        where id=$3 and user_id=$4
      returning id, user_id, text, cast(strftime('%s', due) as integer)*1000 as due, status`,
      [clean, dueMs, id, req.user.id]
    )

    const row = rows?.[0]
    if (!row) return res.status(404).json({ error: 'not found' })

    if (new Date(row.due).getTime() > Date.now()) await scheduleReminder(row).catch(() => {})
    res.json(row)
  } catch {
    res.status(500).json({ error: 'update failed' })
  }
})

export default r
