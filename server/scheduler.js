import schedule from 'node-schedule'
import webpush from 'web-push'
import { query } from './db.js'

const jobs = new Map()

export async function scheduleReminder(rem){
  try {
    const when = new Date(rem.due)
    if (when.getTime() <= Date.now()) return
    const job = schedule.scheduleJob(when, async () => {
      try {
        const { rows: subs } = await query('select id, data from subscriptions where user_id=$1', [rem.user_id])
        if (!subs.length) return
        const payload = JSON.stringify({ title:'Напоминание', body: rem.text, id: rem.id, due: rem.due })
        const toDelete = []
        await Promise.allSettled(subs.map(async s => {
          try {
            await webpush.sendNotification(s.data, payload)
          } catch (e) {
            const code = e?.statusCode
            if (code === 404 || code === 410) toDelete.push(s.id)
          }
        }))
        if (toDelete.length){
          await query(`delete from subscriptions where id = any($1::int[])`, [toDelete])
        }
      } catch (e) {
        console.error('[job send]', e)
      }
    })
    jobs.set(rem.id, job)
  } catch (error) {
    console.error('[scheduleReminder] Error:', error.message)
  }
}

export function cancelReminder(id){
  try {
    const job = jobs.get(id)
    if (job){ 
      job.cancel(); 
      jobs.delete(id) 
    }
  } catch (error) {
    console.error('[cancelReminder] Error:', error.message)
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

    // Запрос напоминаний
    let rows = []
    try {
      const result = await query('select id, user_id, text, extract(epoch from due)*1000 as due from reminders where due >= now()')
      rows = result?.rows || []
    } catch (dbError) {
      console.error('[bootSchedule] Database query failed:', dbError.message)
      return
    }

    // Планирование напоминаний
    if (rows && Array.isArray(rows)) {
      console.log(`[bootSchedule] Scheduling ${rows.length} reminders`)
      rows.forEach(scheduleReminder)
    } else {
      console.log('[bootSchedule] No reminders to schedule')
    }
    
  } catch (error) {
    console.error('[bootSchedule] Critical error:', error.message)
  }
}