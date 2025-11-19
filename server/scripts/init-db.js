import { query } from '../db.js'

async function init(){
  // enable pgcrypto for gen_random_uuid if available
  try { await query('create extension if not exists pgcrypto') } catch {}

  await query(`
    create table if not exists users(
      id serial primary key,
      email text unique not null,
      pass text not null,
      created_at timestamptz not null default now()
    );
  `)

  await query(`
    create table if not exists reminders(
      id uuid primary key,
      user_id int references users(id) on delete cascade,
      text text not null,
      due timestamptz not null,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_reminders_due on reminders(due);
  `)

  await query(`
    create table if not exists subscriptions(
      id serial primary key,
      user_id int references users(id) on delete cascade,
      endpoint text unique not null,
      data jsonb not null,
      created_at timestamptz not null default now()
    );
  `)

  console.log('[db] migrations ok')
}

init().catch(e => {
  console.error('[db:init] error', e)
})
