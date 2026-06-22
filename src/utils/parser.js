import dayjs from 'dayjs'
import 'dayjs/locale/ru.js'

dayjs.locale('ru')

const MONTHS = {
  января: 0, феврал: 1, марта: 2, апрел: 3, мая: 4, июня: 5,
  июля: 6, август: 7, сентябр: 8, октябр: 9, ноября: 10, декабря: 11,
}

export function formatDueSpoken(due) {
  const date = dayjs(due)
  const today = dayjs().startOf('day')
  if (date.isSame(today, 'day')) return `сегодня в ${date.format('HH:mm')}`
  if (date.isSame(today.add(1, 'day'), 'day')) return `завтра в ${date.format('HH:mm')}`
  return date.format('D MMMM в HH:mm')
}

export function parse(input, now = new Date()) {
  if (!input) return null

  const base = dayjs(now)
  let text = String(input).toLowerCase().replace(/\s+/g, ' ').trim()

  text = text
    .replace(/^(поли|полли|оля|ассистент|помощник)[,:]?\s*/i, '')
    .replace(/^(напомни|добавь|создай|поставь|запиши|зафиксируй|сохрани)\s+/i, '')
    .replace(/^(мне\s+)?(задач[ауеы]|напоминани[ея])\s+/i, '')
    .replace(/^(пожалуйста|ладно|хорошо)\s+/i, '')
    .replace(/^напоминани[ея]\s+/i, '')
    .replace(/^добавь\s+задачу\s+/i, '')
    .replace(/(пожалуйста|ладно|хорошо|спасибо)$/i, '')
    .trim()

  if (!text) return null
  if (/^(что|какие|какая|какое)(\s|$)/.test(text)) return null

  const dateInfo = extractDateTime(text, base) || base.add(1, 'hour')
  if (!dateInfo) return null

  const task = cleanTask(text)
  if (!task) return null

  return { task, due: dateInfo.toDate() }
}

function extractDateTime(text, base) {
  let m = text.match(/через\s+(\d+)\s*(минут|минута|минуты|мин|час|часа|часов|ч)(?:\s|$)/)
  if (m) {
    const n = Number(m[1])
    const unit = /мин/.test(m[2]) ? 'minute' : 'hour'
    return base.add(n, unit)
  }

  m = text.match(/через\s+(\d+)\s*(день|дня|дней|сутки|суток)(?:\s|$)/)
  if (m) return base.add(Number(m[1]), 'day')

  m = text.match(/через\s+(\d+)\s*(неделю|недели|недель)(?:\s|$)/)
  if (m) return base.add(Number(m[1]), 'week')

  const hms = pickTime(text)

  if (text.includes('послезавтра')) return applyTime(base.add(2, 'day'), hms || { h: 9, m: 0 })
  if (text.includes('завтра')) return applyTime(base.add(1, 'day'), hms || { h: 9, m: 0 })
  if (text.includes('сегодня')) return applyTime(base, hms || { h: 9, m: 0 })

  const weekday = pickWeekday(text)
  if (weekday !== null) {
    const current = base.day()
    let add = (weekday - current + 7) % 7
    if (add === 0) add = 7
    return applyTime(base.add(add, 'day'), hms || { h: 9, m: 0 })
  }

  m = text.match(/(^|\s)(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?(\s|$)/)
  if (m) {
    const d = Number(m[2])
    const mon = Number(m[3]) - 1
    let y = m[4] ? Number(m[4]) : base.year()
    if (y < 100) y += 2000
    const t = hms || { h: 9, m: 0 }
    return dayjs(new Date(y, mon, d, t.h, t.m))
  }

  m = text.match(/(^|\s)(\d{1,2})\s+([а-яё]+)(\s|$)/i)
  if (m) {
    const d = Number(m[2])
    const raw = m[3]
    const key = Object.keys(MONTHS).find((k) => raw.startsWith(k))
    if (key) {
      const mon = MONTHS[key]
      const t = hms || { h: 9, m: 0 }
      let dt = dayjs(new Date(base.year(), mon, d, t.h, t.m))
      if (dt.isBefore(base)) dt = dt.add(1, 'year')
      return dt
    }
  }

  if (hms) {
    let dt = applyTime(base, hms)
    if (dt.isBefore(base)) dt = dt.add(1, 'day')
    return dt
  }

  return null
}

function pickTime(text) {
  let m = text.match(/(?:^|\s)в\s*(\d{1,2})[:\.](\d{2})(?:\s|$)/)
  if (m) return { h: Number(m[1]), m: Number(m[2]) }

  m = text.match(/(?:^|\s)(\d{1,2})[:\.](\d{2})(?:\s|$)/)
  if (m) return { h: Number(m[1]), m: Number(m[2]) }

  m = text.match(/(?:^|\s)в\s*(\d{1,2})\s+(\d{1,2})(?:\s|$)/)
  if (m) return { h: Number(m[1]), m: Number(m[2]) }

  m = text.match(/(?:^|\s)в\s*(\d{1,2})(?:\s|$)/)
  if (m) {
    let h = Number(m[1])
    if ((text.includes('вечер') || text.includes('ноч')) && h < 12) h += 12
    if (text.includes('утр') && h === 12) h = 0
    return { h, m: 0 }
  }

  return null
}

function pickWeekday(text) {
  if (text.includes('понедельник')) return 1
  if (text.includes('вторник')) return 2
  if (text.includes('среда') || text.includes('среду')) return 3
  if (text.includes('четверг')) return 4
  if (text.includes('пятница') || text.includes('пятницу')) return 5
  if (text.includes('суббота') || text.includes('субботу')) return 6
  if (text.includes('воскресенье')) return 0
  return null
}

function applyTime(d, time) {
  return d.hour(time.h).minute(time.m).second(0).millisecond(0)
}

function cleanTask(text) {
  return text
    .replace(/послезавтра|завтра|сегодня/g, ' ')
    .replace(/^(напомни|добавь|создай|поставь|запиши|зафиксируй|сохрани)\s+/i, ' ')
    .replace(/^(мне\s+)?(задач[ауеы]|напоминани[ея])\s+/i, ' ')
    .replace(/^напоминани[ея]\s+/i, ' ')
    .replace(/через\s+\d+\s*(минут|минута|минуты|мин|час|часа|часов|ч|день|дня|дней|сутки|суток|неделю|недели|недель)/g, ' ')
    .replace(/(?:^|\s)в\s*\d{1,2}\s+\d{1,2}(?:\s|$)/g, ' ')
    .replace(/(?:^|\s)в\s*\d{1,2}([:\.]\d{2})?/g, ' ')
    .replace(/(?:^|\s)\d{1,2}[\.\/-]\d{1,2}([\.\/-]\d{2,4})?/g, ' ')
    .replace(/(?:^|\s)\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/g, ' ')
    .replace(/понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|субботу|воскресенье/g, ' ')
    .replace(/\b(пожалуйста|ладно|хорошо|спасибо|готово|конец|всё)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^задач[ауеы]?\s+/i, '')
    .replace(/^в\s+/i, '')
    .replace(/^а\s+/i, '')
    .trim()
}
