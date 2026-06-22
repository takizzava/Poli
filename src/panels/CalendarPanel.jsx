import { useMemo, useState } from 'react'

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function CalendarPanel({ items }) {
  const today = new Date()
  const [current, setCurrent] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))

  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
  const startWeekday = (monthStart.getDay() + 6) % 7

  const tasksByDay = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const due = new Date(item.due)
      const key = keyOf(due)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    for (const arr of map.values()) arr.sort((a, b) => new Date(a.due) - new Date(b.due))
    return map
  }, [items])

  const cells = useMemo(() => {
    const out = []
    for (let i = 0; i < startWeekday; i += 1) out.push(null)
    for (let d = 1; d <= monthEnd.getDate(); d += 1) out.push(new Date(current.getFullYear(), current.getMonth(), d))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [current, monthEnd, startWeekday])

  const selectedTasks = tasksByDay.get(keyOf(selected)) || []

  return (
    <section className="calendar-panel">
      <header className="calendar-head">
        <button type="button" className="ghost" onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1))}>←</button>
        <h4>{monthStart.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h4>
        <button type="button" className="ghost" onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1))}>→</button>
      </header>

      <div className="calendar-weekdays">
        {WEEK.map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="calendar-grid">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="day-cell empty" />
          const isToday = keyOf(date) === keyOf(today)
          const isSelected = keyOf(date) === keyOf(selected)
          const count = (tasksByDay.get(keyOf(date)) || []).length
          return (
            <button
              key={keyOf(date)}
              type="button"
              className={`day-cell day-btn ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelected(date)}
            >
              <b>{date.getDate()}</b>
              <span className="task-count">{count ? `${count} задач` : '—'}</span>
              {count > 0 && <span className="dot-row" />}
            </button>
          )
        })}
      </div>

      <section className="day-details">
        <h5>
          {selected.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })} · {selectedTasks.length} задач
        </h5>
        {selectedTasks.length === 0 ? (
          <p className="muted">На этот день задач нет.</p>
        ) : (
          <div className="day-task-list">
            {selectedTasks.map((task) => (
              <article key={task.id} className="day-task-item">
                <strong>{new Date(task.due).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</strong>
                <span>{task.text}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function keyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
