// server/index.js — clean, full-featured starter compatible with your client
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import morgan from 'morgan'

import authRouter from './routes/auth.js'
import remindersRouter from './routes/reminders.js'
import pushRouter from './routes/push.js'
import aiRouter from './routes/ai.js'
import ttsRouter from './routes/tts.js'
import notificationSettingsRouter from './routes/notification-settings.js'
import { bootSchedule } from './scheduler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// ---- CORS (dev-friendly) ----
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, cb) => (!origin || corsOrigins.includes(origin)) ? cb(null, true) : cb(new Error('CORS blocked: '+origin), false),
  credentials: true
}))

app.use(morgan('dev'))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// --- Debug route to check cookies quickly
app.get('/api/_debug', (req, res)=>{
  res.json({ cookies: req.cookies || {}, headers: req.headers })
})

// API routes
app.use('/api', authRouter)
app.use('/api', remindersRouter)
app.use('/api', pushRouter)
app.use('/api', aiRouter)
app.use('/api', ttsRouter)
app.use('/api', notificationSettingsRouter)

// Static build (if you run npm run build)
const pub = path.join(__dirname, 'public')
app.use(express.static(pub))
app.get('*', (req, res) => res.sendFile(path.join(pub, 'index.html')))

const PORT = Number(process.env.PORT || 8080)
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`)
  bootSchedule().catch(e => console.error('[bootSchedule]', e))
})
