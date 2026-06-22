import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'

const r = Router()
r.use(withAuth)

function normalize(row, userId) {
  if (!row) {
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

  let quietHours = []
  try { quietHours = row.quiet_hours ? JSON.parse(row.quiet_hours) : [] } catch {}

  return {
    ...row,
    push_enabled: Boolean(row.push_enabled),
    email_enabled: Boolean(row.email_enabled),
    in_app_enabled: Boolean(row.in_app_enabled),
    do_not_disturb_enabled: Boolean(row.do_not_disturb_enabled),
    quiet_hours: quietHours
  }
}

async function getOrCreateSettings(userId) {
  let rows = await query('SELECT * FROM notification_settings WHERE user_id = $1', [userId])
  if (!rows.length) {
    await query('INSERT INTO notification_settings (user_id) VALUES ($1)', [userId])
    rows = await query('SELECT * FROM notification_settings WHERE user_id = $1', [userId])
  }
  return normalize(rows[0], userId)
}

function validateSettings(body) {
  const errors = []
  for (const key of ['push_enabled', 'email_enabled', 'in_app_enabled', 'do_not_disturb_enabled']) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') errors.push(`${key} must be boolean`)
  }

  for (const key of ['do_not_disturb_start', 'do_not_disturb_end']) {
    if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== 'string' || !/^\d{2}:\d{2}$/.test(body[key]))) {
      errors.push(`${key} must be in HH:MM format`)
    }
  }

  if (body.timezone !== undefined && body.timezone !== null && (typeof body.timezone !== 'string' || !body.timezone.trim())) {
    errors.push('timezone must be a non-empty string')
  }

  if (body.quiet_hours !== undefined && body.quiet_hours !== null) {
    if (!Array.isArray(body.quiet_hours)) errors.push('quiet_hours must be an array')
  }

  return errors
}

r.get('/notification-settings', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user.id)
    res.json(settings)
  } catch {
    res.status(500).json({ error: 'failed to get settings' })
  }
})

r.put('/notification-settings', async (req, res) => {
  try {
    const validationErrors = validateSettings(req.body || {})
    if (validationErrors.length) return res.status(400).json({ error: 'validation failed', details: validationErrors })

    await getOrCreateSettings(req.user.id)

    const updates = []
    const values = []
    let idx = 1

    const fields = ['push_enabled', 'email_enabled', 'in_app_enabled', 'do_not_disturb_enabled', 'do_not_disturb_start', 'do_not_disturb_end', 'timezone', 'quiet_hours']

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field}=$${idx}`)
        if (field === 'quiet_hours') values.push(JSON.stringify(req.body[field] || []))
        else if (['push_enabled', 'email_enabled', 'in_app_enabled', 'do_not_disturb_enabled'].includes(field)) values.push(req.body[field] ? 1 : 0)
        else values.push(req.body[field])
        idx++
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'no fields to update' })

    updates.push("updated_at=datetime('now')")
    values.push(req.user.id)

    const rows = await query(
      `UPDATE notification_settings
          SET ${updates.join(', ')}
        WHERE user_id=$${idx}
      RETURNING *`,
      values
    )

    res.json(normalize(rows[0], req.user.id))
  } catch {
    res.status(500).json({ error: 'failed to update settings' })
  }
})

export default r
