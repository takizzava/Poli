
// src/api/reminders.js
// Клиентский API: корректный POST с JSON и куками.

export async function listReminders(){
  const r = await fetch('/api/reminders', { credentials:'include' })
  if (!r.ok) return []
  return await r.json()
}

export async function createReminder(text, due){
  const r = await fetch('/api/reminders', {
    method:'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ text, due }),
    credentials:'include'
  })
  if (!r.ok) {
    const t = await r.text().catch(()=> '')
    console.error('[createReminder] HTTP', r.status, t)
    const err = new Error('create failed: ' + r.status + ' ' + t)
    err.status = r.status
    err.payload = t
    throw err
  }
  return await r.json()
}

export async function deleteReminder(id){
  const r = await fetch('/api/reminders/'+encodeURIComponent(id), {
    method:'DELETE',
    credentials:'include'
  })
  if (!r.ok) throw new Error('delete failed: ' + r.status)
  return await r.json()
}
