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
      status text default 'pending' check (status in ('pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
      sent_at timestamptz,
      retry_count int default 0 check (retry_count >= 0),
      created_at timestamptz not null default now()
    );
  `)
  
  // Миграция: добавить поля к существующей таблице (если их нет)
  try {
    await query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`)
    await query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;`)
    await query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;`)
    
    // Добавить constraint для status, если его нет
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'reminders_status_check'
        ) THEN
          ALTER TABLE reminders ADD CONSTRAINT reminders_status_check 
            CHECK (status IN ('pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'));
        END IF;
      END $$;
    `)
    
    // Добавить constraint для retry_count, если его нет
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'reminders_retry_count_check'
        ) THEN
          ALTER TABLE reminders ADD CONSTRAINT reminders_retry_count_check 
            CHECK (retry_count >= 0);
        END IF;
      END $$;
    `)
  } catch (migrationError) {
    console.warn('[db:init] Migration warning (may already exist):', migrationError.message)
  }

  try {
    await query(`
      create index if not exists idx_reminders_due on reminders(due);
      create index if not exists idx_reminders_user_due on reminders(user_id, due);
      create index if not exists idx_reminders_status on reminders(status) where status = 'pending';
    `)
  } catch (idxErr) {
    console.warn('[db:init] Reminder indexes warning:', idxErr.message)
  }

  await query(`
    create table if not exists subscriptions(
      id serial primary key,
      user_id int references users(id) on delete cascade,
      endpoint text unique not null,
      data jsonb not null,
      created_at timestamptz not null default now()
    );
  `)

  // Таблица настроек уведомлений
  await query(`
    create table if not exists notification_settings(
      user_id int primary key references users(id) on delete cascade,
      push_enabled boolean default true,
      email_enabled boolean default false,
      in_app_enabled boolean default true,
      do_not_disturb_enabled boolean default false,
      do_not_disturb_start time,
      do_not_disturb_end time,
      timezone text default 'Europe/Moscow',
      quiet_hours jsonb default '[]'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `)

  // Миграция: добавить поля к существующей таблице (если их нет)
  try {
    await query(`
      ALTER TABLE notification_settings 
      ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS do_not_disturb_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS do_not_disturb_start TIME,
      ADD COLUMN IF NOT EXISTS do_not_disturb_end TIME,
      ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Moscow',
      ADD COLUMN IF NOT EXISTS quiet_hours JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    `)
  } catch (migrationError) {
    console.warn('[db:init] Notification settings migration warning:', migrationError.message)
  }

  // Индекс для быстрого поиска настроек
  await query(`
    create index if not exists idx_notification_settings_user on notification_settings(user_id);
  `)

  console.log('[db] migrations ok')
}

init().catch(e => {
  console.error('[db:init] error', e)
})
