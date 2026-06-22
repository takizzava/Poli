import fs from 'fs'
import path from 'path'
import { query } from '../db.js'

async function init() {
  const dbFile = process.env.SQLITE_FILE || path.resolve(process.cwd(), 'server', 'data', 'app.sqlite')
  fs.mkdirSync(path.dirname(dbFile), { recursive: true })

  await query(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      pass TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS reminders(
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      due TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  await query(`CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders(user_id, due)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)`)

  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS notification_settings(
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      push_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 0,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      do_not_disturb_enabled INTEGER NOT NULL DEFAULT 0,
      do_not_disturb_start TEXT,
      do_not_disturb_end TEXT,
      timezone TEXT DEFAULT 'Europe/Moscow',
      quiet_hours TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS api_tokens(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    )
  `)

  await query(`CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id)`)

  console.log('[db] sqlite migrations ok')
}

init().catch((e) => {
  console.error('[db:init] error', e)
  process.exitCode = 1
})
