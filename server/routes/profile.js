// server/routes/profile.js
import { Router } from 'express'
import { query } from '../db.js'
import { withAuth } from './auth.js'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const upload = multer({ dest: 'server/uploads', limits: { fileSize: 2 * 1024 * 1024 } })
const r = Router()
r.use(withAuth)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '..', 'uploads')
try { fs.mkdirSync(uploadDir, { recursive: true }) } catch {}

r.get('/profile', async (req, res) => {
  try {
    const rows = await query('select id, email, display_name, avatar_url, created_at from users where id=$1', [req.user.id])
    res.json(rows[0] || {})
  } catch {
    res.status(500).json({ error: 'profile_failed' })
  }
})

r.put('/profile', async (req, res) => {
  try {
    const name = String(req.body?.display_name || '').trim().slice(0, 120)
    const rows = await query('update users set display_name=$1 where id=$2 returning id, email, display_name, avatar_url, created_at', [name || null, req.user.id])
    res.json(rows[0] || {})
  } catch {
    res.status(500).json({ error: 'update_failed' })
  }
})

r.post('/profile/password', async (req, res) => {
  try {
    const { current, next } = req.body || {}
    if (!current || !next) return res.status(400).json({ error: 'passwords_required' })
    if (String(next).length < 6) return res.status(400).json({ error: 'password_too_short' })

    const rows = await query('select pass from users where id=$1', [req.user.id])
    const user = rows[0]
    if (!user) return res.status(404).json({ error: 'not_found' })
    if (!bcrypt.compareSync(String(current), user.pass)) return res.status(401).json({ error: 'current_invalid' })

    const hash = bcrypt.hashSync(String(next), 10)
    await query('update users set pass=$1 where id=$2', [hash, req.user.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'password_failed' })
  }
})

r.post('/profile/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file_required' })
    const ext = path.extname(req.file.originalname || '').slice(0, 6) || '.png'
    const safeName = `u${req.user.id}_${Date.now()}${ext}`
    const dest = path.join(uploadDir, safeName)
    fs.renameSync(req.file.path, dest)
    const url = `/uploads/${safeName}`

    const rows = await query('update users set avatar_url=$1 where id=$2 returning id, email, display_name, avatar_url, created_at', [url, req.user.id])
    res.json(rows[0] || {})
  } catch {
    res.status(500).json({ error: 'avatar_failed' })
  }
})

r.get('/profile/stats', async (req, res) => {
  try {
    const rows = await query(
      `select
         sum(case when user_id=$1 then 1 else 0 end) as total,
         sum(case when user_id=$1 and status='sent' then 1 else 0 end) as done,
         sum(case when user_id=$1 and status in ('pending','scheduled','sending') then 1 else 0 end) as active,
         sum(case when user_id=$1 and status='failed' then 1 else 0 end) as failed,
         sum(case when user_id=$1 and due < datetime('now') and status in ('pending','scheduled','sending') then 1 else 0 end) as overdue,
         sum(case when user_id=$1 and sent_at >= datetime('now','-7 day') then 1 else 0 end) as done_7d,
         sum(case when user_id=$1 and sent_at >= datetime('now','-30 day') then 1 else 0 end) as done_30d
       from reminders`,
      [req.user.id]
    )

    const row = rows[0] || {}
    Object.keys(row).forEach((k) => { row[k] = Number(row[k] || 0) })
    res.json(row)
  } catch {
    res.status(500).json({ error: 'stats_failed' })
  }
})

export default r
