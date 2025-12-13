// server/routes/notification-settings.js
import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'

const r = Router()
r.use(withAuth)

// Получить или создать настройки по умолчанию
async function getOrCreateSettings(userId) {
  try {
    let rows = await query(
      'SELECT * FROM notification_settings WHERE user_id = $1',
      [userId]
    )
    
    if (rows.length === 0) {
      // Создаем настройки по умолчанию
      try {
        await query(
          `INSERT INTO notification_settings (user_id) VALUES ($1)`,
          [userId]
        )
        rows = await query(
          'SELECT * FROM notification_settings WHERE user_id = $1',
          [userId]
        )
      } catch (insertError) {
        // Если таблица не существует, возвращаем настройки по умолчанию
        if (insertError?.message?.includes('does not exist') || insertError?.code === '42P01') {
          console.warn('[getOrCreateSettings] Table notification_settings does not exist, returning defaults')
          return {
            user_id: userId,
            push_enabled: true,
            email_enabled: false,
            in_app_enabled: true,
            do_not_disturb_enabled: false,
            do_not_disturb_start: null,
            do_not_disturb_end: null,
            timezone: 'Europe/Moscow',
            quiet_hours: []
          }
        }
        throw insertError
      }
    }
    
    return rows[0]
  } catch (error) {
    console.error('[getOrCreateSettings] Error:', error?.message || error)
    // Возвращаем настройки по умолчанию при ошибке
    return {
      user_id: userId,
      push_enabled: true,
      email_enabled: false,
      in_app_enabled: true,
      do_not_disturb_enabled: false,
      do_not_disturb_start: null,
      do_not_disturb_end: null,
      timezone: 'Europe/Moscow',
      quiet_hours: []
    }
  }
}

// Валидация настроек
function validateSettings(body) {
  const errors = []
  
  // Валидация boolean полей
  if (body.push_enabled !== undefined && typeof body.push_enabled !== 'boolean') {
    errors.push('push_enabled must be boolean')
  }
  if (body.email_enabled !== undefined && typeof body.email_enabled !== 'boolean') {
    errors.push('email_enabled must be boolean')
  }
  if (body.in_app_enabled !== undefined && typeof body.in_app_enabled !== 'boolean') {
    errors.push('in_app_enabled must be boolean')
  }
  if (body.do_not_disturb_enabled !== undefined && typeof body.do_not_disturb_enabled !== 'boolean') {
    errors.push('do_not_disturb_enabled must be boolean')
  }
  
  // Валидация времени
  if (body.do_not_disturb_start !== undefined && body.do_not_disturb_start !== null) {
    if (typeof body.do_not_disturb_start !== 'string' || !/^\d{2}:\d{2}$/.test(body.do_not_disturb_start)) {
      errors.push('do_not_disturb_start must be in HH:MM format')
    }
  }
  if (body.do_not_disturb_end !== undefined && body.do_not_disturb_end !== null) {
    if (typeof body.do_not_disturb_end !== 'string' || !/^\d{2}:\d{2}$/.test(body.do_not_disturb_end)) {
      errors.push('do_not_disturb_end must be in HH:MM format')
    }
  }
  
  // Валидация таймзоны
  if (body.timezone !== undefined && body.timezone !== null) {
    if (typeof body.timezone !== 'string' || body.timezone.length === 0) {
      errors.push('timezone must be a non-empty string')
    }
  }
  
  // Валидация quiet_hours
  if (body.quiet_hours !== undefined && body.quiet_hours !== null) {
    if (!Array.isArray(body.quiet_hours)) {
      errors.push('quiet_hours must be an array')
    } else {
      for (const qh of body.quiet_hours) {
        if (typeof qh !== 'object' || !qh.start || !qh.end) {
          errors.push('quiet_hours items must have start and end in HH:MM format')
          break
        }
        if (!/^\d{2}:\d{2}$/.test(qh.start) || !/^\d{2}:\d{2}$/.test(qh.end)) {
          errors.push('quiet_hours start and end must be in HH:MM format')
          break
        }
      }
    }
  }
  
  return errors
}

// GET /api/notification-settings
r.get('/notification-settings', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user.id)
    res.json(settings)
  } catch (e) {
    console.error('[notification-settings:get]', e?.message || e)
    res.status(500).json({ error: 'failed to get settings' })
  }
})

// PUT /api/notification-settings
r.put('/notification-settings', async (req, res) => {
  try {
    const validationErrors = validateSettings(req.body)
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'validation failed', details: validationErrors })
    }
    
    // Убеждаемся, что настройки существуют
    await getOrCreateSettings(req.user.id)
    
    // Формируем UPDATE запрос только для переданных полей
    const updates = []
    const values = []
    let paramIndex = 1
    
    const allowedFields = [
      'push_enabled', 'email_enabled', 'in_app_enabled',
      'do_not_disturb_enabled', 'do_not_disturb_start', 'do_not_disturb_end',
      'timezone', 'quiet_hours'
    ]
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'quiet_hours') {
          updates.push(`${field} = $${paramIndex}::jsonb`)
          values.push(JSON.stringify(req.body[field]))
        } else {
          updates.push(`${field} = $${paramIndex}`)
          values.push(req.body[field])
        }
        paramIndex++
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'no fields to update' })
    }
    
    // Добавляем updated_at
    updates.push(`updated_at = now()`)
    values.push(req.user.id)
    
    const sql = `
      UPDATE notification_settings 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `
    
    const rows = await query(sql, values)
    const updated = rows[0]
    
    res.json(updated)
  } catch (e) {
    console.error('[notification-settings:update]', e?.message || e)
    res.status(500).json({ error: 'failed to update settings' })
  }
})

export default r

