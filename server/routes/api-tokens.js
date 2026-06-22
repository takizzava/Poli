// server/routes/api-tokens.js
import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'
import crypto from 'crypto'

const r = Router()
r.use(withAuth)

function genToken() {
  return crypto.randomBytes(24).toString('hex')
}

// List tokens
r.get('/api-tokens', async (req, res) => {
  try {
    const rows = await query(
      'select id, name, created_at, last_used_at from api_tokens where user_id=$1 order by created_at desc',
      [req.user.id]
    )
    res.json(rows || [])
  } catch (e) {
    console.error('[api-tokens:list]', e?.message || e)
    res.status(500).json({ error: 'list_failed' })
  }
})

// Create token
r.post('/api-tokens', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 100) || 'integration'
    const token = genToken()
    const rows = await query(
      'insert into api_tokens(user_id, token, name) values($1,$2,$3) returning id, token, name, created_at',
      [req.user.id, token, name]
    )
    res.json(rows[0])
  } catch (e) {
    console.error('[api-tokens:create]', e?.message || e)
    res.status(500).json({ error: 'create_failed' })
  }
})

// Delete token
r.delete('/api-tokens/:id', async (req, res) => {
  try {
    const id = Number(req.params.id || 0)
    if (!id) return res.status(400).json({ error: 'bad_id' })
    const rows = await query('delete from api_tokens where id=$1 and user_id=$2 returning id', [id, req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true, id })
  } catch (e) {
    console.error('[api-tokens:delete]', e?.message || e)
    res.status(500).json({ error: 'delete_failed' })
  }
})

export default r
