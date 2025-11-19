// server/db.js — SSL toggle; returns rows[]
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

function sslEnabled(){
  const flag = (process.env.PGSSL || '').toString().toLowerCase().trim()
  if (flag === '1' || flag === 'true' || flag === 'on') return true
  return false
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // IMPORTANT: force-disable SSL for local DB unless PGSSL=1
  ssl: sslEnabled() ? { rejectUnauthorized: false } : false
})

export async function query(q, params = []){
  const client = await pool.connect()
  try{
    const res = await client.query(q, params)
    return res.rows
  } catch(e){
    console.error('[db] query failed:', e?.message || e)
    throw e
  } finally {
    client.release()
  }
}

export default pool