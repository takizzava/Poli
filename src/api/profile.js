export async function fetchProfile() {
  const r = await fetch('/api/profile', { credentials: 'include' })
  if (!r.ok) throw new Error('profile fetch failed')
  return r.json()
}

export async function updateProfile(display_name) {
  const r = await fetch('/api/profile', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name })
  })
  if (!r.ok) throw new Error('profile update failed')
  return r.json()
}

export async function changePassword(current, next) {
  const r = await fetch('/api/profile/password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current, next })
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(t || 'password change failed')
  }
  return r.json()
}

export async function uploadAvatar(file) {
  const fd = new FormData()
  fd.append('avatar', file)
  const r = await fetch('/api/profile/avatar', {
    method: 'POST',
    credentials: 'include',
    body: fd
  })
  if (!r.ok) throw new Error('avatar upload failed')
  return r.json()
}

export async function fetchStats() {
  const r = await fetch('/api/profile/stats', { credentials: 'include' })
  if (!r.ok) throw new Error('stats fetch failed')
  return r.json()
}
