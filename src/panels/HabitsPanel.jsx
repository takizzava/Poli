import { useMemo, useState } from 'react'

const DEFAULT_HABITS = ['Вода', 'Тренировка', 'Чтение', 'Медитация']

export default function HabitsPanel() {
  const today = new Date().toISOString().slice(0, 10)
  const [habits, setHabits] = useState(() => {
    const raw = localStorage.getItem('habits-list-v1')
    return raw ? JSON.parse(raw) : DEFAULT_HABITS
  })
  const [marks, setMarks] = useState(() => {
    const raw = localStorage.getItem('habits-marks-v1')
    return raw ? JSON.parse(raw) : {}
  })
  const [newHabit, setNewHabit] = useState('')

  const doneCount = useMemo(() => habits.filter((name) => marks[`${today}:${name}`]).length, [habits, marks, today])

  function toggle(name) {
    const key = `${today}:${name}`
    const next = { ...marks, [key]: !marks[key] }
    setMarks(next)
    localStorage.setItem('habits-marks-v1', JSON.stringify(next))
  }

  function addHabit() {
    const value = newHabit.trim()
    if (!value || habits.includes(value)) return
    const next = [...habits, value]
    setHabits(next)
    setNewHabit('')
    localStorage.setItem('habits-list-v1', JSON.stringify(next))
  }

  return (
    <div className="habits-panel">
      <div className="habits-head">
        <h4>Привычки на сегодня</h4>
        <span>{doneCount}/{habits.length}</span>
      </div>

      <div className="habits-add">
        <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} placeholder="Новая привычка" />
        <button type="button" className="primary" onClick={addHabit}>Добавить</button>
      </div>

      <div className="habits-list">
        {habits.map((name) => {
          const isDone = !!marks[`${today}:${name}`]
          return (
            <label className={`habit-row ${isDone ? 'done' : ''}`} key={name}>
              <input type="checkbox" checked={isDone} onChange={() => toggle(name)} />
              <span>{name}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
