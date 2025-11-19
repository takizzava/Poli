// src/utils/parser.js
// Русский парсер: «напомни/создай/добавь…», «через …», dd.mm / "5 июня",
// дни недели, время цифрами и словами, полдень/полночь/обед/утром/вечером.

import dayjs from 'dayjs'
import 'dayjs/locale/ru.js'
dayjs.locale('ru')

// ===== словари =====
const MONTHS = {
  'янв':'01','фев':'02','мар':'03','апр':'04','май':'05','мая':'05',
  'июн':'06','июл':'07','авг':'08','сен':'09','сент':'09','окт':'10','ноя':'11','дек':'12'
}
const WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']
const NUM = {
  'ноль':0,'нул':0,
  'один':1,'одна':1,'одно':1,
  'два':2,'две':2,
  'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,
  'десять':10,'одиннадцать':11,'двенадцать':12,'тринадцать':13,'четырнадцать':14,'пятнадцать':15,
  'шестнадцать':16,'семнадцать':17,'восемнадцать':18,'девятнадцать':19,
  'двадцать':20,'тридцать':30,'сорок':40,'пятьдесят':50
}

export function formatDueSpoken(d) {
  const date = dayjs(d)
  const today = dayjs().startOf('day')
  const tomorrow = today.add(1, 'day')
  const after = today.add(2, 'day')
  if (date.isSame(today, 'day')) return 'сегодня в ' + date.format('HH:mm')
  if (date.isSame(tomorrow, 'day')) return 'завтра в ' + date.format('HH:mm')
  if (date.isSame(after, 'day')) return 'послезавтра в ' + date.format('HH:mm')
  return date.format('D MMMM в HH:mm')
}

export function parse(input, now = new Date()) {
  if (!input) return null
  const original = String(input)
  let text = original
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  // убрать обращения/вежливости/служебные префиксы (в т.ч. распознаваемые ошибки)
  text = text
    .replace(/\b(поли|полли|поля|poly|оля)[,]?\s*/g, '')           // «Поли», «Полли», «Поля», «Оля»
    .replace(/^.*?\b(создай|добавь)\s+(мне\s+)?напоминан\w*\b[,:]?\s*/i, '')
    .replace(/^.*?\bнапомн(?:и|ю)\b[,:]?\s*/i, '')                // «напомни» и «напомню»
    .replace(/\bпожалуйста\b/g, '')
    .trim()

  const base = dayjs(now)

  // ---------- ОТНОСИТЕЛЬНО ----------
  if (/через\s+полтора\s*часа?/.test(text)) {
    return pack(cleanTask(stripOnce(text, /через\s+полтора\s*часа?/), original), base.add(90,'minute').toDate())
  }
  if (/через\s+пол\s*часа?/.test(text)) {
    return pack(cleanTask(stripOnce(text, /через\s+пол\s*часа?/), original), base.add(30,'minute').toDate())
  }
  let m = text.match(/через\s+(\d+)\s*(час(?:а|ов)?|ч)\s*(\d+)?\s*(мин(?:ут[уы])?|м)?/)
  if (m) {
    const h = parseInt(m[1],10)||0
    const mm = parseInt(m[3],10)||0
    return pack(cleanTask(stripOnce(text, m[0]), original), base.add(h,'hour').add(mm,'minute').toDate())
  }
  m = text.match(/через\s+(\d+)\s*(мин(?:ут[уы])?|м|час(?:а|ов)?|ч)\b/)
  if (m) {
    const val = parseInt(m[1],10)
    const unit = /мин|м/.test(m[2]) ? 'minute' : 'hour'
    return pack(cleanTask(stripOnce(text, m[0]), original), base.add(val, unit).toDate())
  }

  // ---------- ДАТА dd.mm(.yyyy) ----------
  const ddmm = text.match(/\b(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?\b/)
  if (ddmm) {
    const d = +ddmm[1], mon = +ddmm[2]-1, y = normalizeYear(ddmm[3] ? +ddmm[3] : base.year())
    let date = dayjs(new Date(y, mon, d)).hour(9).minute(0).second(0)
    const t = pickTime(text) || pickWordTime(text)
    if (t) date = date.hour(t.h).minute(t.m)
    return pack(cleanTask(stripOnce(stripTime(text), ddmm[0]), original), date.toDate())
  }

  // ---------- ДАТА «5 июня» ----------
  const dmon = text.match(/\b(\d{1,2})\s+(янв\w*|фев\w*|мар\w*|апр\w*|ма[йя]|июн\w*|июл\w*|авг\w*|сен\w*|окт\w*|ноя\w*|дек\w*)\b/)
  if (dmon) {
    const d = +dmon[1]
    const mon = (dmon[2]||'').slice(0,3)
    const mIdx = parseInt(MONTHS[mon],10)-1
    let date = dayjs(new Date(base.year(), mIdx, d)).hour(9).minute(0)
    const t = pickTime(text) || pickWordTime(text)
    if (t) date = date.hour(t.h).minute(t.m)
    return pack(cleanTask(stripOnce(stripTime(text), dmon[0]), original), date.toDate())
  }

  // ---------- СЕГОДНЯ/ЗАВТРА/ПОСЛЕЗАВТРА ----------
  const dayWord = text.match(/\b(сегодня|завтра|послезавтра)\b/)
  if (dayWord) {
    let d = base.startOf('day')
    if (dayWord[1]==='завтра') d = d.add(1,'day')
    if (dayWord[1]==='послезавтра') d = d.add(2,'day')
    const t = pickTime(text) || pickWordTime(text) || { h:9, m:0 }
    return pack(cleanTask(stripOnce(stripTime(text), dayWord[0]), original), d.hour(t.h).minute(t.m).toDate())
  }

  // ---------- ДЕНЬ НЕДЕЛИ ----------
  const wd = text.match(/\b(в|во)\s+(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)\b/)
  if (wd) {
    const target = normWeekday(wd[2])
    const cur = base.day()
    let add = (target - cur + 7) % 7
    if (add===0) add = 7
    let d = base.add(add,'day').startOf('day')
    const t = pickTime(text) || pickWordTime(text) || { h:9, m:0 }
    return pack(cleanTask(stripOnce(stripTime(text), wd[0]), original), d.hour(t.h).minute(t.m).toDate())
  }

  // ---------- ТОЛЬКО ВРЕМЯ (даже без «в») ----------
  const tNum = pickTime(text) || pickBareTime(text) || pickWordTime(text)
  if (tNum) {
    let dt = base.hour(tNum.h).minute(tNum.m)
    if (dt.isBefore(base)) dt = dt.add(1,'day') // прошло — завтра
    return pack(cleanTask(stripTime(text), original), dt.toDate())
  }

  return null
}

// ===== helpers =====
function normalizeYear(y){ return (y && y < 100) ? 2000 + y : y }

function stripOnce(s, chunk){
  const c = (typeof chunk === 'string') ? chunk : (s.match(chunk)?.[0] || '')
  return s.replace(c,' ').replace(/\s+/g,' ').trim()
}

function pack(taskStr, due){
  const task = cleanTask(taskStr)
  return { task, due }
}

function cleanTask(task, original){
  // убрать служебные маркеры, дни и время
  const cleaned = (task ?? '')
    .replace(/^(мне|пожалуйста)\s+/g,'')
    .replace(/^(в|во)\s+/, '')
    .replace(/\b(сегодня|завтра|послезавтра)\b/g,' ')
    .replace(timeRegex(), ' ')
    .replace(/\b(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim()

  if (cleaned) return cleaned

  const rest = String(original||task||'').toLowerCase()
    .replace(/^.*?\b(создай|добавь)\s+(мне\s+)?напоминан\w*\b/i,'')
    .replace(/^.*?\bнапомн(?:и|ю)\b/i,'')
    .trim()

  const tail = rest.split(/\s+/).slice(-6).join(' ')
  return tail || 'напоминание'
}

// --- время цифрами с «в …» ---
function pickTime(text){
  // 1) в 7:05 / 7.05 / 7-05
  let m = text.match(/\bв\s*(\d{1,2})\s*[:\.\-]\s*(\d{2})\b/)
  if (m) return applyMeridiem({ h:+m[1], m:+m[2] }, text)

  // 2) в 7 05
  m = text.match(/\bв\s*(\d{1,2})\s+(\d{2})\b/)
  if (m) return applyMeridiem({ h:+m[1], m:+m[2] }, text)

  // 3) в 12 часов 30 минут / в 7 ч 05 м
  m = text.match(/\bв\s*(\d{1,2})\s*(?:час(?:а|ов)?|ч)\s*(\d{1,2})\s*(?:мин(?:ут[уы])?|м)\b/)
  if (m) return applyMeridiem({ h:+m[1], m:+m[2] }, text)

  // 4) в 7 утра/вечера/ночью | в 7ч вечера
  m = text.match(/\bв\s*(\d{1,2})\s*(?:час(?:а|ов)?|ч)?\s*(утра|вечера|ноч(?:ью|и))?\b/)
  if (m) return applyMeridiem({ h:+m[1], m:0 }, text, m[2]||'')

  // спец-лексика без цифр (когда сказали только «вечером»)
  if (/\bполдень\b/.test(text)) return { h:12, m:0 }
  if (/\bполночь\b/.test(text)) return { h:0, m:0 }
  if (/\bобед\b/.test(text)) return { h:13, m:0 }
  if (/\bвечер(ом)?\b/.test(text)) return { h:19, m:0 }
  if (/\bутр(ом)?\b/.test(text)) return { h:9, m:0 }
  if (/\bдн(ём|ем)\b/.test(text)) return { h:13, m:0 }
  if (/\bноч(ью|и)\b/.test(text)) return { h:22, m:0 }

  return null
}

// --- время цифрами БЕЗ «в»: «12:30», «12 30», «12-30» ---
function pickBareTime(text){
  let m = text.match(/\b(\d{1,2})\s*[:\.\-]\s*(\d{2})\b/)
  if (m) return applyMeridiem({ h:+m[1], m:+m[2] }, text)
  m = text.match(/\b(\d{1,2})\s+(\d{2})\b/)
  if (m) return applyMeridiem({ h:+m[1], m:+m[2] }, text)
  return null
}

// --- время словами: «в двенадцать тридцать», «в пять вечера», «в семь ноль пять» ---
function pickWordTime(text){
  const rx = /\bв\s+([а-яё\s-]{2,40}?)(?:\s+(утра|вечера|ноч(?:ью|и)))?\b/
  const m = text.match(rx)
  if (!m) return null

  const chunk = m[1]
    .replace(/-/g,' ')
    .replace(/\bчас(?:а|ов)?\b/g,'')
    .replace(/\bминут(?:а|ы)?\b/g,'')
    .trim()

  const tokens = chunk.split(/\s+/).slice(0,3)
  const h = readNumber(tokens[0])
  if (h == null) return null

  let mm = 0
  if (tokens[1]){
    const m2 = readNumber(tokens[1] + (tokens[2] ? ' ' + tokens[2] : ''))
    if (m2 != null) mm = m2
  }

  return applyMeridiem({ h, m:mm }, text, m[2]||'')
}

function readNumber(words){
  const parts = words.trim().split(/\s+/)
  let sum = 0; let seen = false
  for (const w of parts){
    if (!(w in NUM)) return seen ? sum : null
    sum += NUM[w]; seen = true
  }
  if (!seen) return null
  if (sum > 59) return null
  return sum
}

function applyMeridiem(t, text, direct){
  let { h, m } = t
  const mode = direct || (/\bвечер|ноч(ью|и)\b/.test(text) ? 'pm' : /\bутра\b/.test(text) ? 'am' : '')
  if (mode === 'pm' && h < 12) h += 12
  if (mode === 'am' && h === 12) h = 0
  return { h, m }
}

// — удаление времени для очистки task
function stripTime(s){
  return s.replace(timeRegex(), ' ').replace(/\s+/g,' ').trim()
}

function timeRegex(){
  return /(полдень|полночь|обед|вечер(?:ом)?|утр(?:ом)?|дн(?:ём|ем)|ноч(?:ью|и)|\bв\s*\d{1,2}[:\.\-]\d{2}\b|\bв\s*\d{1,2}\s+\d{2}\b|\bв\s*\d{1,2}\s*(?:час(?:а|ов)?|ч)\s*\d{1,2}\s*(?:мин(?:ут[уы])?|м)\b|\bв\s*\d{1,2}(?:\s*(?:час(?:а|ов)?|ч))?\s*(?:утра|вечера|ноч(?:ью|и))?\b|\bв\s+(?:[а-яё\s-]{2,40}?)(?:\s+(?:утра|вечера|ноч(?:ью|и)))?|\b\d{1,2}\s*[:\.\-]\s*\d{2}\b|\b\d{1,2}\s+\d{2}\b)/gi
}

function normWeekday(w){
  w = w.replace('среду','среда').replace('пятницу','пятница').replace('субботу','суббота')
  return WEEKDAYS.indexOf(w)
}
