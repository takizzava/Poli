// server/routes/reminders.js
import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'
import { randomUUID } from 'crypto'

const r = Router()
r.use(withAuth)

// GET /api/reminders
r.get('/reminders', async (req, res) => {
  try {
    const rows = await query(
      `select id, text, extract(epoch from due)*1000 as due
         from reminders
        where user_id = $1
        order by due asc`,
      [req.user.id]
    )
    res.json(rows || [])
  } catch (e) {
    console.error('[reminders:list]', e?.message || e)
    res.status(500).json({ error: 'list failed' })
  }
})

// POST /api/reminders
r.post('/reminders', async (req, res) => {
  try {
    const { text, due } = req.body || {}
    const dueMs = Number(due)
    const clean = String(text || '').trim()
    if (!clean || !Number.isFinite(dueMs))
      return res.status(400).json({ error: 'text and due(ms) required' })

    const id = randomUUID()
    const rows = await query(
      `insert into reminders(id, user_id, text, due)
       values ($1,$2,$3,to_timestamp($4/1000.0))
       returning id, user_id, text, extract(epoch from due)*1000 as due`,
      [id, req.user.id, clean, dueMs]
    )
    res.json(rows[0])
  } catch (e) {
    console.error('[reminders:create]', e?.message || e)
    res.status(500).json({ error: 'create failed' })
  }
})

// DELETE /api/reminders/:id
r.delete('/reminders/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '')
    const rows = await query(
      `delete from reminders where id=$1 and user_id=$2 returning id`,
      [id, req.user.id]
    )
    const row = rows[0]
    if (!row) return res.status(404).json({ error: 'not found' })
    res.json({ ok: true, id })
  } catch (e) {
    console.error('[reminders:delete]', e?.message || e)
    res.status(500).json({ error: 'delete failed' })
  }
})

export default r
