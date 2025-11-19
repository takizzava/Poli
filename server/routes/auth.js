// server/routes/auth.js — clear bad cookie on invalid signature
import { Router } from 'express'
import { query } from '../db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const r = Router()

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000
})

function signToken(uid) {
  return jwt.sign({ uid }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' })
}

export async function withAuth(req, res, next) {
  try {
    const token = req.cookies?.sid
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { uid } = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    const rows = await query('select id, email from users where id = $1', [uid])
    const user = rows && rows[0]
    if (!user) {
      res.clearCookie('sid', cookieOpts())
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.user = user
    next()
  } catch (e) {
    console.error('[auth middleware]', e?.message || e)
    // drop stale/invalid cookie to stop spammy 401s
    try { res.clearCookie('sid', cookieOpts()) } catch {}
    res.status(401).json({ error: 'Unauthorized' })
  }
}

r.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    const normalized = String(email).toLowerCase().trim()
    const hash = bcrypt.hashSync(String(password), 10)

    const rows = await query('insert into users(email, pass) values ($1, $2) returning id, email', [normalized, hash])
    const user = rows && rows[0]
    if (!user) return res.status(500).json({ error: 'signup failed' })

    const token = signToken(user.id)
    res.cookie('sid', token, cookieOpts())
    res.json({ ok: true, user })
  } catch (e) {
    const msg = e?.message || ''
    if (msg.includes('duplicate')) return res.status(409).json({ error: 'email already registered' })
    console.error('[signup]', msg)
    res.status(500).json({ error: 'signup failed' })
  }
})

r.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const rows = await query('select * from users where email = $1', [String(email).toLowerCase().trim()])
    const user = rows && rows[0]
    if (!user) return res.status(401).json({ error: 'invalid credentials' })

    const ok = bcrypt.compareSync(String(password), user.pass)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    const token = signToken(user.id)
    res.cookie('sid', token, cookieOpts())
    res.json({ ok: true, user: { id: user.id, email: user.email } })
  } catch (e) {
    console.error('[login]', e?.message || e)
    res.status(500).json({ error: 'login failed' })
  }
})

r.post('/logout', (req, res) => { res.clearCookie('sid', cookieOpts()); res.json({ ok: true }) })
r.get('/me', withAuth, (req, res) => { res.json({ id: req.user.id, email: req.user.email }) })

export default r