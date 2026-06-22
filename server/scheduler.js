import schedule from 'node-schedule'
import webpush from 'web-push'
import { query } from './db.js'

const jobs = new Map()

async function getUserNotificationSettings(userId) {
  const rows = await query('SELECT * FROM notification_settings WHERE user_id = $1', [userId])
  const row = rows[0]
  if (!row) {
    return {
      push_enabled: 1,
      do_not_disturb_enabled: 0,
      do_not_disturb_start: null,
      do_not_disturb_end: null,
      quiet_hours: []
    }
  }

  let quietHours = []
  try { quietHours = row.quiet_hours ? JSON.parse(row.quiet_hours) : [] } catch {}
  return { ...row, quiet_hours: quietHours }
}

function canSendNow(settings) {
  if (!settings) return true

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  if (settings.do_not_disturb_enabled) {
    const start = settings.do_not_disturb_start
    const end = settings.do_not_disturb_end
    if (start && end) {
      if (start > end) {
        if (currentTime >= start || currentTime < end) return false
      } else if (currentTime >= start && currentTime < end) {
        return false
      }
    }
  }

  if (Array.isArray(settings.quiet_hours)) {
    for (const qh of settings.quiet_hours) {
      if (!qh?.start || !qh?.end) continue
      if (qh.start > qh.end) {
        if (currentTime >= qh.start || currentTime < qh.end) return false
      } else if (currentTime >= qh.start && currentTime < qh.end) {
        return false
      }
    }
  }

  return true
}

async function sendReminder(rem, isMissed = false) {
  const reminderId = rem.id
  const userId = rem.user_id

  try {
    const existing = await query('SELECT status, sent_at FROM reminders WHERE id = $1', [reminderId])
    if (existing[0]?.status === 'sent' && existing[0]?.sent_at) return

    const settings = await getUserNotificationSettings(userId)
    if (!canSendNow(settings) || !settings.push_enabled) {
      await query("UPDATE reminders SET status='sent', sent_at=datetime('now') WHERE id=$1", [reminderId])
      return
    }

    await query("UPDATE reminders SET status='sending' WHERE id=$1", [reminderId])

    const subs = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1', [userId])
    if (!subs.length) {
      await query("UPDATE reminders SET status='sent', sent_at=datetime('now') WHERE id=$1", [reminderId])
      return
    }

    const title = isMissed ? 'Пропущенное напоминание' : 'Напоминание'
    const payload = JSON.stringify({ title, body: rem.text, id: reminderId, due: rem.due })

    const toDelete = []
    let successCount = 0

    await Promise.allSettled(subs.map(async (s) => {
      try {
        const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
        await webpush.sendNotification(subscription, payload)
        successCount += 1
      } catch (e) {
        const code = e?.statusCode
        if (code === 404 || code === 410) toDelete.push(s.id)
      }
    }))

    if (toDelete.length) {
      const placeholders = toDelete.map((_, i) => `$${i + 1}`).join(',')
      await query(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`, toDelete)
    }

    if (successCount === 0) {
      await query("UPDATE reminders SET status='failed', retry_count = retry_count + 1 WHERE id=$1", [reminderId])
      return
    }

    await query("UPDATE reminders SET status='sent', sent_at=datetime('now') WHERE id=$1", [reminderId])
  } catch {
    await query("UPDATE reminders SET status='failed', retry_count = retry_count + 1 WHERE id=$1", [reminderId]).catch(() => {})
  }
}

export async function scheduleReminder(rem) {
  const reminderId = rem.id
  const when = new Date(rem.due)

  if (when.getTime() <= Date.now()) {
    await sendReminder(rem, true)
    return
  }

  cancelReminder(reminderId)
  await query("UPDATE reminders SET status='scheduled' WHERE id=$1", [reminderId]).catch(() => {})

  const job = schedule.scheduleJob(when, async () => {
    try { await sendReminder(rem, false) } finally { jobs.delete(reminderId) }
  })

  if (job) jobs.set(reminderId, job)
}

export function cancelReminder(id) {
  const job = jobs.get(id)
  if (job) {
    job.cancel()
    jobs.delete(id)
  }
}

export async function bootSchedule() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:example@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
    } catch {}
  }

  const missedCutoff = Date.now() - 24 * 60 * 60 * 1000
  const missed = await query(
    `SELECT id, user_id, text, cast(strftime('%s', due) as integer)*1000 as due
       FROM reminders
      WHERE due >= datetime($1/1000, 'unixepoch')
        AND due < datetime('now')
        AND (sent_at IS NULL OR status IN ('pending', 'scheduled'))
      ORDER BY due ASC`,
    [missedCutoff]
  ).catch(() => [])

  for (const rem of missed) {
    await sendReminder(rem, true).catch(() => {})
  }

  const rows = await query(
    `SELECT id, user_id, text, cast(strftime('%s', due) as integer)*1000 as due, status
       FROM reminders
      WHERE due >= datetime('now')
        AND status IN ('pending', 'scheduled')
      ORDER BY due ASC`
  ).catch(() => [])

  for (const rem of rows) {
    await scheduleReminder(rem).catch(() => {})
  }
}
