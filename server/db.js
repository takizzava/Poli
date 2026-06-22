import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import dotenv from 'dotenv'

dotenv.config()

const dbFile = process.env.SQLITE_FILE || path.resolve(process.cwd(), 'server', 'data', 'app.sqlite')
fs.mkdirSync(path.dirname(dbFile), { recursive: true })

const db = new DatabaseSync(dbFile)
db.exec('PRAGMA foreign_keys = ON;')
db.exec('PRAGMA journal_mode = WAL;')

function convertPositional(sql, params) {
  const order = []
  const text = sql.replace(/\$(\d+)/g, (_m, g1) => {
    order.push(Number(g1) - 1)
    return '?'
  })
  const nextParams = order.length ? order.map((idx) => params[idx]) : params
  return { text, params: nextParams }
}

export async function query(sql, params = []) {
  const { text, params: bind } = convertPositional(sql, params)
  const stmt = db.prepare(text)
  const lower = text.trim().toLowerCase()

  if (lower.startsWith('select') || lower.includes(' returning ')) {
    return stmt.all(...bind)
  }

  stmt.run(...bind)
  return []
}

export default db
