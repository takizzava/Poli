export async function listTokens() {
  const r = await fetch('/api/api-tokens', { credentials: 'include' })
  if (!r.ok) throw new Error('failed to list tokens')
  return r.json()
}

export async function createToken(name) {
  const r = await fetch('/api/api-tokens', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!r.ok) throw new Error('failed to create token')
  return r.json()
}

export async function deleteToken(id) {
  const r = await fetch('/api/api-tokens/' + encodeURIComponent(id), {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!r.ok) throw new Error('failed to delete token')
  return r.json()
}
