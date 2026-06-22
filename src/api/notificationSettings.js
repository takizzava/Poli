const defaults = {
  push_enabled: true,
  email_enabled: false,
  in_app_enabled: true,
  do_not_disturb_enabled: false,
  do_not_disturb_start: null,
  do_not_disturb_end: null,
  timezone: 'Europe/Moscow',
  quiet_hours: []
}

export async function getNotificationSettings() {
  const res = await fetch('/api/notification-settings', { credentials: 'include' })
  if (!res.ok) throw new Error('failed to fetch notification settings')
  const json = await res.json()
  return { ...defaults, ...json }
}

export async function updateNotificationSettings(body) {
  const res = await fetch('/api/notification-settings', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'failed to update notification settings')
  }
  const json = await res.json()
  return { ...defaults, ...json }
}
