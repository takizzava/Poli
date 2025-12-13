import schedule from 'node-schedule'
import webpush from 'web-push'
import { query } from './db.js'

const jobs = new Map()

// Получить настройки уведомлений пользователя
async function getUserNotificationSettings(userId) {
  try {
    const rows = await query(
      `SELECT * FROM notification_settings WHERE user_id = $1`,
      [userId]
    )
    return rows[0] || {
      push_enabled: true,
      email_enabled: false,
      in_app_enabled: true,
      do_not_disturb_enabled: false,
      do_not_disturb_start: null,
      do_not_disturb_end: null,
      timezone: 'Europe/Moscow',
      quiet_hours: []
    }
  } catch (e) {
    console.error('[getUserNotificationSettings] Error:', e?.message || e)
    // Возвращаем настройки по умолчанию при ошибке
    return {
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

// Проверить, можно ли отправлять уведомление сейчас (с учетом "не беспокоить" и quiet_hours)
function canSendNow(settings, reminderDue) {
  if (!settings) return true
  
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  // Проверка "не беспокоить"
  if (settings.do_not_disturb_enabled) {
    const start = settings.do_not_disturb_start
    const end = settings.do_not_disturb_end
    
    if (start && end) {
      // Если start > end, значит период переходит через полночь
      if (start > end) {
        if (currentTime >= start || currentTime < end) {
          console.log(`[canSendNow] Do not disturb active: ${currentTime} is between ${start} and ${end}`)
          return false
        }
      } else {
        if (currentTime >= start && currentTime < end) {
          console.log(`[canSendNow] Do not disturb active: ${currentTime} is between ${start} and ${end}`)
          return false
        }
      }
    }
  }
  
  // Проверка quiet_hours
  if (settings.quiet_hours && Array.isArray(settings.quiet_hours)) {
    for (const qh of settings.quiet_hours) {
      if (qh.start && qh.end) {
        const start = qh.start
        const end = qh.end
        
        if (start > end) {
          if (currentTime >= start || currentTime < end) {
            console.log(`[canSendNow] Quiet hours active: ${currentTime} is in ${start}-${end}`)
            return false
          }
        } else {
          if (currentTime >= start && currentTime < end) {
            console.log(`[canSendNow] Quiet hours active: ${currentTime} is in ${start}-${end}`)
            return false
          }
        }
      }
    }
  }
  
  return true
}

// Функция отправки напоминания
async function sendReminder(rem, isMissed = false) {
  const reminderId = rem.id
  const userId = rem.user_id
  
  try {
    // Идемпотентность: проверяем, не отправлено ли уже
    const existing = await query(
      `SELECT status, sent_at FROM reminders WHERE id = $1`,
      [reminderId]
    )
    
    if (existing.length > 0 && existing[0].status === 'sent' && existing[0].sent_at) {
      console.log(`[sendReminder] Reminder ${reminderId} already sent at ${existing[0].sent_at}, skipping`)
      return
    }
    
    // Получаем настройки уведомлений
    const settings = await getUserNotificationSettings(userId)
    
    // Проверяем, можно ли отправлять сейчас
    if (!canSendNow(settings, rem.due)) {
      console.log(`[sendReminder] Cannot send reminder ${reminderId} - do not disturb or quiet hours active`)
      // Помечаем как отправленное, но не отправляем (чтобы не повторять)
      await query(
        `UPDATE reminders SET status='sent', sent_at=now() WHERE id=$1`,
        [reminderId]
      )
      return
    }
    
    // Обновляем статус на "sending"
    await query(
      `UPDATE reminders SET status='sending' WHERE id=$1`,
      [reminderId]
    )
    
    // Проверяем, включены ли push-уведомления
    if (!settings.push_enabled) {
      console.log(`[sendReminder] Push notifications disabled for user ${userId}`)
      await query(
        `UPDATE reminders SET status='sent', sent_at=now() WHERE id=$1`,
        [reminderId]
      )
      return
    }
    
    const subs = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1',
      [userId]
    )
    
    if (!subs.length) {
      console.log(`[sendReminder] No push subscriptions for user ${userId}`)
      await query(
        `UPDATE reminders SET status='sent', sent_at=now() WHERE id=$1`,
        [reminderId]
      )
      return
    }
    
    const title = isMissed ? 'Пропущенное напоминание' : 'Напоминание'
    const payload = JSON.stringify({ 
      title, 
      body: rem.text, 
      id: reminderId, 
      due: rem.due 
    })
    
    const toDelete = []
    let successCount = 0
    const errors = []
    
    await Promise.allSettled(subs.map(async s => {
      try {
        // Формируем объект подписки из отдельных полей
        const subscription = {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth
          }
        }
        await webpush.sendNotification(subscription, payload)
        successCount++
      } catch (e) {
        const code = e?.statusCode
        const errorMsg = e?.message || 'unknown error'
        errors.push({ subscriptionId: s.id, code, error: errorMsg })
        
        if (code === 404 || code === 410) {
          toDelete.push(s.id)
        }
      }
    }))
    
    if (toDelete.length) {
      console.log(`[sendReminder] Deleting ${toDelete.length} invalid subscriptions`)
      await query(`DELETE FROM push_subscriptions WHERE id = ANY($1::int[])`, [toDelete])
    }
    
    if (errors.length > 0 && successCount === 0) {
      // Все попытки провалились
      console.error(`[sendReminder] All delivery attempts failed for reminder ${reminderId}:`, errors)
      await query(
        `UPDATE reminders SET status='failed', retry_count = retry_count + 1 WHERE id=$1`,
        [reminderId]
      )
      return
    }
    
    // Обновляем статус на "sent"
    await query(
      `UPDATE reminders SET status='sent', sent_at=now() WHERE id=$1`,
      [reminderId]
    )
    
    console.log(`[sendReminder] ✅ Sent reminder ${reminderId} to ${successCount}/${subs.length} subscribers`)
    if (errors.length > 0) {
      console.warn(`[sendReminder] ⚠️ Some errors occurred: ${errors.length} failed, ${successCount} succeeded`)
    }
  } catch (e) {
    console.error(`[sendReminder] ❌ Error sending reminder ${reminderId}:`, e?.message || e)
    console.error('[sendReminder] Stack:', e?.stack)
    
    // Обновляем статус на "failed" и увеличиваем счетчик попыток
    try {
      await query(
        `UPDATE reminders SET status='failed', retry_count = retry_count + 1 WHERE id=$1`,
        [reminderId]
      )
    } catch (updateErr) {
      console.error('[sendReminder] Failed to update status to failed:', updateErr?.message || updateErr)
    }
  }
}

export async function scheduleReminder(rem){
  const reminderId = rem.id
  
  try {
    const when = new Date(rem.due)
    const now = Date.now()
    
    // Edge-case: уже прошло - отправить сразу
    if (when.getTime() <= now) {
      console.log(`[scheduleReminder] Reminder ${reminderId} is in the past, sending immediately`)
      await sendReminder(rem, true)
      return
    }
    
    // Edge-case: слишком далеко (больше года)
    const oneYear = 365 * 24 * 60 * 60 * 1000
    if (when.getTime() - now > oneYear) {
      console.warn(`[scheduleReminder] ⚠️ Reminder ${reminderId} too far in future (${Math.round((when.getTime() - now) / (24 * 60 * 60 * 1000))} days), skipping`)
      return
    }
    
    // Отменить старое, если есть
    cancelReminder(reminderId)
    
    // Обновить статус на "scheduled"
    try {
      await query(
        `UPDATE reminders SET status='scheduled' WHERE id=$1`,
        [reminderId]
      )
    } catch (err) {
      console.error(`[scheduleReminder] Failed to update status for ${reminderId}:`, err?.message || err)
    }
    
    const job = schedule.scheduleJob(when, async () => {
      try {
        await sendReminder(rem, false)
      } catch (err) {
        console.error(`[scheduleReminder] Job execution error for ${reminderId}:`, err?.message || err)
      } finally {
        jobs.delete(reminderId)
      }
    })
    
    if (job) {
      jobs.set(reminderId, job)
      console.log(`[scheduleReminder] ✅ Scheduled reminder ${reminderId} for ${when.toISOString()}`)
    } else {
      console.error(`[scheduleReminder] ❌ Failed to create job for reminder ${reminderId}`)
    }
  } catch (error) {
    console.error(`[scheduleReminder] ❌ Error scheduling reminder ${reminderId}:`, error?.message || error)
    console.error('[scheduleReminder] Stack:', error?.stack)
  }

}

export function cancelReminder(id){
  try {
    const job = jobs.get(id)
    if (job){ 
      job.cancel()
      jobs.delete(id)
      console.log(`[cancelReminder] ✅ Cancelled reminder ${id}`)
    } else {
      console.log(`[cancelReminder] No job found for reminder ${id}`)
    }
  } catch (error) {
    console.error(`[cancelReminder] ❌ Error cancelling reminder ${id}:`, error?.message || error)
  }
}

export async function bootSchedule(){
  try {
    // VAPID инициализация
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY){
      try {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || 'mailto:example@example.com',
          process.env.VAPID_PUBLIC_KEY, 
          process.env.VAPID_PRIVATE_KEY
        )
        console.log('[push] VAPID keys initialized')
      } catch (vapidError) {
        console.warn('[push] VAPID initialization failed:', vapidError.message)
      }
    } else {
      console.warn('[push] VAPID keys are not set — push delivery will fail')
    }

    // КРИТИЧНО: Обработать пропущенные напоминания (за последние 24 часа)
    const missedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    try {
      const missed = await query(
        `SELECT id, user_id, text, extract(epoch from due)*1000 as due 
         FROM reminders 
         WHERE due >= to_timestamp($1/1000.0) 
         AND due < now() 
         AND (sent_at IS NULL OR status IN ('pending', 'scheduled'))
         ORDER BY due ASC`,
        [missedCutoff.getTime()]
      )
      
      if (missed && missed.length > 0) {
        console.log(`[bootSchedule] Found ${missed.length} missed reminders, sending...`)
        for (const rem of missed) {
          try {
            await sendReminder(rem, true)
          } catch (err) {
            console.error(`[bootSchedule] Error sending missed reminder ${rem.id}:`, err?.message || err)
          }
        }
      }
    } catch (missedError) {
      console.error('[bootSchedule] Failed to process missed reminders:', missedError.message)
    }

    // Запрос будущих напоминаний
    let rows = []
    try {
      const result = await query(
        `SELECT id, user_id, text, extract(epoch from due)*1000 as due, status
         FROM reminders 
         WHERE due >= now() 
         AND status IN ('pending', 'scheduled')
         ORDER BY due ASC`
      )
      rows = result || []
    } catch (dbError) {
      console.error('[bootSchedule] Database query failed:', dbError.message)
      return
    }

    // Планирование напоминаний
    if (rows && Array.isArray(rows)) {
      console.log(`[bootSchedule] Scheduling ${rows.length} future reminders`)
      let scheduled = 0
      let failed = 0
      
      for (const rem of rows) {
        try {
          await scheduleReminder(rem)
          scheduled++
        } catch (err) {
          console.error(`[bootSchedule] Error scheduling reminder ${rem.id}:`, err?.message || err)
          failed++
        }
      }
      
      console.log(`[bootSchedule] ✅ Scheduled ${scheduled} reminders, ${failed} failed`)
    } else {
      console.log('[bootSchedule] No reminders to schedule')
    }
    
  } catch (error) {
    console.error('[bootSchedule] Critical error:', error.message)
  }
}
