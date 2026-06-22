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
import apiTokensRouter from './routes/api-tokens.js'
import profileRouter from './routes/profile.js'
import externalRouter from './routes/external.js'
import { bootSchedule } from './scheduler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (envOrigins.includes(origin)) return cb(null, true)
      if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true)
      return cb(new Error(`CORS blocked: ${origin}`), false)
    },
    credentials: true,
  })
)

app.use(morgan('dev'))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: 'sqlite', now: new Date().toISOString() })
})

app.get('/api/_debug', (req, res) => {
  res.json({ cookies: req.cookies || {}, headers: req.headers })
})

app.use('/api', authRouter)
app.use('/api', remindersRouter)
app.use('/api', pushRouter)
app.use('/api', aiRouter)
app.use('/api', ttsRouter)
app.use('/api', notificationSettingsRouter)
app.use('/api', apiTokensRouter)
app.use('/api', profileRouter)
app.use('/api', externalRouter)

const pub = path.join(__dirname, 'public')
app.use(express.static(pub))
app.get('*', (_req, res) => res.sendFile(path.join(pub, 'index.html')))

const PORT = Number(process.env.PORT || 8787)
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`)
  bootSchedule().catch((e) => console.error('[bootSchedule]', e))
})
