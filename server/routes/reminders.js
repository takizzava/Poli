// server/routes/reminders.js
import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'
import { randomUUID } from 'crypto'
import { scheduleReminder, cancelReminder } from '../scheduler.js'

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
    
    // Валидация текста
    if (!clean || clean.length < 1 || clean.length > 1000) {
      return res.status(400).json({ error: 'text must be 1-1000 characters' })
    }
    
    // Валидация даты
    if (!Number.isFinite(dueMs)) {
      return res.status(400).json({ error: 'due must be a valid timestamp' })
    }
    
    const dueDate = new Date(dueMs)
    const now = Date.now()
    const maxFuture = now + 365 * 24 * 60 * 60 * 1000 // 1 год
    
    if (dueDate.getTime() < now - 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'due date cannot be more than 24h in the past' })
    }
    if (dueDate.getTime() > maxFuture) {
      return res.status(400).json({ error: 'due date cannot be more than 1 year in the future' })
    }
    
    // Проверка на дубликаты (идемпотентность)
    const existing = await query(
      `SELECT id FROM reminders 
       WHERE user_id = $1 
       AND text = $2 
       AND ABS(EXTRACT(EPOCH FROM (due - to_timestamp($3/1000.0)))) < 300
       LIMIT 1`,
      [req.user.id, clean, dueMs]
    )
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'duplicate', 
        existing: existing[0],
        message: 'Similar reminder already exists' 
      })
    }

    const id = randomUUID()
    const rows = await query(
      `insert into reminders(id, user_id, text, due, status)
       values ($1,$2,$3,to_timestamp($4/1000.0),'pending')
       returning id, user_id, text, extract(epoch from due)*1000 as due, status`,
      [id, req.user.id, clean, dueMs]
    )
    
    const reminder = rows[0]
    
    // КРИТИЧНО: Планируем напоминание в scheduler
    if (reminder && new Date(reminder.due).getTime() > Date.now()) {
      await scheduleReminder(reminder).catch(err => {
        console.error('[reminders:create] Failed to schedule:', err)
        // Не прерываем создание, но логируем ошибку
      })
    }
    
    res.json(reminder)
  } catch (e) {
    console.error('[reminders:create]', e?.message || e)
    res.status(500).json({ error: 'create failed' })
  }
})

// DELETE /api/reminders/:id
r.delete('/reminders/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '')
    
    // КРИТИЧНО: Отменяем запланированное напоминание перед удалением
    cancelReminder(id)
    
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

// PUT /api/reminders/:id
r.put('/reminders/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '')
    const { text, due } = req.body || {}
    const dueMs = Number(due)
    const clean = String(text || '').trim()
    
    // Валидация
    if (!clean || clean.length < 1 || clean.length > 1000) {
      return res.status(400).json({ error: 'text must be 1-1000 characters' })
    }
    
    if (!Number.isFinite(dueMs)) {
      return res.status(400).json({ error: 'due must be a valid timestamp' })
    }
    
    const dueDate = new Date(dueMs)
    const now = Date.now()
    const maxFuture = now + 365 * 24 * 60 * 60 * 1000
    
    if (dueDate.getTime() < now - 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'due date cannot be more than 24h in the past' })
    }
    if (dueDate.getTime() > maxFuture) {
      return res.status(400).json({ error: 'due date cannot be more than 1 year in the future' })
    }
    
    // КРИТИЧНО: Отменяем старое напоминание
    cancelReminder(id)

    const rows = await query(
      `update reminders set text=$1, due=to_timestamp($2/1000.0), status='pending', sent_at=NULL where id=$3 and user_id=$4 returning id, user_id, text, extract(epoch from due)*1000 as due, status`,
      [clean, dueMs, id, req.user.id]
    )
    const row = rows && rows[0]
    if (!row) return res.status(404).json({ error: 'not found' })
    
    // КРИТИЧНО: Планируем обновленное напоминание
    if (new Date(row.due).getTime() > Date.now()) {
      await scheduleReminder(row).catch(err => {
        console.error('[reminders:update] Failed to schedule:', err)
      })
    }
    
    res.json(row)
  } catch (e) {
    console.error('[reminders:update]', e?.message || e)
    res.status(500).json({ error: 'update failed' })
  }
})

export default r
