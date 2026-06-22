import { useMemo, useState } from 'react'

const COLUMNS = [
  { key: 'todo', title: 'Нужно сделать' },
  { key: 'doing', title: 'В работе' },
  { key: 'done', title: 'Готово' },
]

const ORDER = COLUMNS.map((column) => column.key)

export default function KanbanPanel({ items }) {
  const [state, setState] = useState(() => {
    const raw = localStorage.getItem('kanban-state-v2')
    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })
  const [dragId, setDragId] = useState(null)

  const tasks = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        status: state[item.id] || 'todo',
      })),
    [items, state]
  )

  const byColumn = useMemo(
    () =>
      COLUMNS.reduce((acc, column) => {
        const list = tasks
          .filter((task) => task.status === column.key)
          .sort((a, b) => new Date(a.due) - new Date(b.due))
        acc[column.key] = list
        return acc
      }, {}),
    [tasks]
  )

  const overdue = useMemo(() => tasks.filter((task) => new Date(task.due) < new Date()).length, [tasks])

  function setTaskStatus(id, nextStatus) {
    const next = { ...state, [id]: nextStatus }
    setState(next)
    localStorage.setItem('kanban-state-v2', JSON.stringify(next))
  }

  function move(id, direction) {
    const current = state[id] || 'todo'
    const index = ORDER.indexOf(current)
    const nextIndex = direction === 'left' ? Math.max(0, index - 1) : Math.min(ORDER.length - 1, index + 1)
    setTaskStatus(id, ORDER[nextIndex])
  }

  function onDrop(columnKey) {
    if (!dragId) return
    setTaskStatus(dragId, columnKey)
    setDragId(null)
  }

  return (
    <section className="kanban-board">
      <header className="kanban-top">
        <div>
          <h3>Канбан задач</h3>
          <p>Перетаскивай карточки между колонками или меняй статус через селект.</p>
        </div>
        <div className="kanban-stats">
          <span>Всего: {tasks.length}</span>
          <span>Просрочено: {overdue}</span>
        </div>
      </header>

      <div className="kanban-grid">
        {COLUMNS.map((column) => (
          <section
            key={column.key}
            className="kanban-col"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(column.key)}
          >
            <header>
              <h4>{column.title}</h4>
              <span>{byColumn[column.key]?.length || 0}</span>
            </header>

            <div className="kanban-stack">
              {(byColumn[column.key] || []).map((task) => {
                const isOverdue = new Date(task.due) < new Date()
                return (
                  <article
                    key={task.id}
                    className={`kanban-card ${dragId === task.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    <p className="task-text">{task.text}</p>
                    <small>{new Date(task.due).toLocaleString('ru-RU')}</small>
                    {isOverdue && <span className="task-badge">ено</span>}

                    <label className="status-field">
                      <span>Статус</span>
                      <select value={task.status} onChange={(event) => setTaskStatus(task.id, event.target.value)}>
                        {COLUMNS.map((option) => (
                          <option key={option.key} value={option.key}>{option.title}</option>
                        ))}
                      </select>
                    </label>

                    <div className="kanban-actions">
                      <button type="button" className="ghost" onClick={() => move(task.id, 'left')}>Назад</button>
                      <button type="button" className="primary" onClick={() => move(task.id, 'right')}>Вперед</button>
                    </div>
                  </article>
                )
              })}

              {(!byColumn[column.key] || byColumn[column.key].length === 0) && (
                <div className="kanban-empty">Пусто. Перетащи сюда задачу.</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
