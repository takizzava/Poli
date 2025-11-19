export async function me(){
  const r = await fetch('/api/me', { credentials:'include' })
  if (!r.ok) throw new Error('no session')
  return await r.json()
}
export async function signup(email, password){
  const r = await fetch('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }), credentials:'include' })
  if (!r.ok) throw new Error('signup failed')
  return (await r.json()).user
}
export async function login(email, password){
  const r = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }), credentials:'include' })
  if (!r.ok) throw new Error('login failed')
  return (await r.json()).user
}
export async function logout(){
  await fetch('/api/logout', { method:'POST', credentials:'include' })
}
