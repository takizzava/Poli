import { useMemo, useState } from 'react'

export default function TasksPanel({ items, api }) {
  const [deletingId, setDeletingId] = useState(null)
  const [filter, setFilter] = useState('all')

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => new Date(left.due) - new Date(right.due)),
    [items]
  )

  const filteredItems = useMemo(() => {
    const now = new Date()
    if (filter === 'overdue') return sortedItems.filter((task) => new Date(task.due) < now)
    if (filter === 'active') return sortedItems.filter((task) => new Date(task.due) >= now)
    return sortedItems
  }, [filter, sortedItems])

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await api.remove(id)
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const exportJson = () => {
    const payload = JSON.stringify(filteredItems, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `reminders-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const overdueCount = sortedItems.filter((task) => new Date(task.due) < new Date()).length

  return (
    <div className="tasks-panel">
      <header className="tasks-head">
        <div>
          <div className="pill">режим ленты</div>
          <h4>Хронология напоминаний</h4>
          <p>Сначала ближайшие дедлайны. Просроченные элементы отмечены отдельным статусом.</p>
        </div>
        <div className="tasks-head-stats">
          <div>
            <strong>{sortedItems.length}</strong>
            <span>всего</span>
          </div>
          <div>
            <strong>{overdueCount}</strong>
            <span>просрочено</span>
          </div>
        </div>
      </header>

      <div className="tasks-toolbar">
        <div className="tasks-filters">
          <button type="button" className={`ghost sm ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>Все</button>
          <button type="button" className={`ghost sm ${filter === 'active' ? 'is-active' : ''}`} onClick={() => setFilter('active')}>Активные</button>
          <button type="button" className={`ghost sm ${filter === 'overdue' ? 'is-active' : ''}`} onClick={() => setFilter('overdue')}>Просроченные</button>
        </div>
        <button type="button" className="ghost sm" onClick={exportJson} disabled={filteredItems.length === 0}>Экспорт JSON</button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="tasks-empty">
          <h5>Задачи по фильтру не найдены</h5>
          <p>Смените фильтр или добавьте новое напоминание через голосовой центр или ручной ввод.</p>
        </div>
      ) : (
        <div className="timeline">
          {filteredItems.map((task, index) => {
            const overdue = new Date(task.due) < new Date()
            return (
              <article
                key={task.id}
                className={`timeline-item ${overdue ? 'overdue' : ''} ${deletingId === task.id ? 'deleting' : ''}`}
              >
                <div className="timeline-rail">
                  <span className="dot" />
                  {index < filteredItems.length - 1 && <span className="line" />}
                </div>

                <div className="card">
                  <div className="card-topline">
                    <span className="task-seq">#{String(index + 1).padStart(2, '0')}</span>
                    {overdue ? <span className="badge">Просрочено</span> : <span className="badge ok">Активно</span>}
                  </div>
                  <div className="text">{task.text}</div>
                  <div className="meta">
                    <span className="date">{formatTaskDate(task.due)}</span>
                    <span className="timestamp">{new Date(task.due).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleDelete(task.id)}
                  disabled={deletingId === task.id}
                >
                  {deletingId === task.id ? 'Удаляем...' : 'Удалить'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatTaskDate(value) {
  const date = new Date(value)
  const now = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(now.getDate() + 1)

  if (date.toDateString() === now.toDateString()) {
    return `Сегодня, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return `Завтра, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

