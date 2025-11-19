import { useState } from 'react'
import '../styles/tasks-panel.css'

export default function TasksPanel({ items, api }){
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    window.location.reload()
    // Даем анимации завершиться
    setTimeout(() => setIsRefreshing(false), 1000)
  }

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

  const formatDate = (date) => {
    const now = new Date()
    const taskDate = new Date(date)
    const isToday = taskDate.toDateString() === now.toDateString()
    const isTomorrow = new Date(now.setDate(now.getDate() + 1)).toDateString() === taskDate.toDateString()
    
    if (isToday) {
      return `Сегодня в ${taskDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    } else if (isTomorrow) {
      return `Завтра в ${taskDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return taskDate.toLocaleDateString('ru-RU', { 
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const isOverdue = (due) => {
    return new Date(due) < new Date()
  }

  const sortedItems = [...items].sort((a, b) => new Date(a.due) - new Date(b.due))

  return (
    <div className="tasks-panel">
      <div className="tasks-card">
        {/* Header */}
        <div className="tasks-header">
          <div className="tasks-title-section">
            <div className="tasks-icon">📋</div>
            <div>
              <h2 className="tasks-title">Мои напоминания</h2>
              <p className="tasks-subtitle">
                {items.length === 0 
                  ? 'Нет активных напоминаний' 
                  : `${items.length} ${getPluralForm(items.length, ['напоминание', 'напоминания', 'напоминаний'])}`
                }
              </p>
            </div>
          </div>
          
          <button 
            className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <span className="refresh-icon">🔄</span>
            {isRefreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>

        {/* Tasks List */}
        <div className="tasks-list">
          {sortedItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3 className="empty-title">Пока нет напоминаний</h3>
              <p className="empty-description">
                Создайте новое напоминание голосом или вручную
              </p>
            </div>
          ) : (
            <div className="tasks-container">
              {sortedItems.map(task => (
                <div 
                  key={task.id} 
                  className={`task-item ${isOverdue(task.due) ? 'overdue' : ''} ${deletingId === task.id ? 'deleting' : ''}`}
                >
                  <div className="task-content">
                    <div className="task-text">{task.text}</div>
                    <div className="task-meta">
                      <span className={`task-date ${isOverdue(task.due) ? 'overdue' : ''}`}>
                        <span className="date-icon">⏰</span>
                        {formatDate(task.due)}
                        {isOverdue(task.due) && <span className="overdue-badge">Просрочено</span>}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(task.id)}
                    disabled={deletingId === task.id}
                    title="Удалить напоминание"
                  >
                    {deletingId === task.id ? (
                      <div className="delete-spinner"></div>
                    ) : (
                      <span className="delete-icon">🗑️</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Footer */}
        {items.length > 0 && (
          <div className="tasks-footer">
            <div className="tasks-stats">
              <div className="stat">
                <span className="stat-value">{items.length}</span>
                <span className="stat-label">всего</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {items.filter(item => isOverdue(item.due)).length}
                </span>
                <span className="stat-label">просрочено</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {items.filter(item => !isOverdue(item.due)).length}
                </span>
                <span className="stat-label">активно</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Вспомогательная функция для склонения слов
function getPluralForm(number, forms) {
  const cases = [2, 0, 1, 1, 1, 2]
  return forms[
    number % 100 > 4 && number % 100 < 20 
      ? 2 
      : cases[number % 10 < 5 ? number % 10 : 5]
  ]
}