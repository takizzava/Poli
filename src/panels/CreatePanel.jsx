import { useState } from 'react'
import '../styles/create-panel.css'

export default function CreatePanel({ api }){
  const [text, setText] = useState('')
  const [when, setWhen] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Введите текст напоминания')
      return
    }
    if (!when) {
      setError('Выберите дату и время')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const due = new Date(when).getTime()
      await api.create(text, due)
      setText('')
      setWhen('')
      // Можно добавить уведомление об успехе
    } catch (err) {
      setError('Ошибка при создании напоминания')
      console.error('Create error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  // Предустановленные времена
  const quickTimes = [
    { label: 'Через 1 час', value: () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16) },
    { label: 'Через 3 часа', value: () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16) },
    { label: 'Завтра утром', value: () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      tomorrow.setHours(9, 0, 0, 0)
      return tomorrow.toISOString().slice(0, 16)
    }},
    { label: 'Вечером', value: () => {
      const today = new Date()
      today.setHours(20, 0, 0, 0)
      if (today < new Date()) today.setDate(today.getDate() + 1)
      return today.toISOString().slice(0, 16)
    }}
  ]

  return (
    <div className="create-panel">
      <div className="create-card">
        {/* Header */}
        <div className="create-header">
          <div className="create-icon">✏️</div>
          <div className="create-info">
            <h2 className="create-title">Новое напоминание</h2>
            <p className="create-subtitle">Создайте напоминание вручную</p>
          </div>
        </div>

        {/* Quick Times */}
        <div className="quick-times">
          <h4 className="quick-times-title">Быстрый выбор:</h4>
          <div className="quick-times-grid">
            {quickTimes.map((quickTime, index) => (
              <button
                key={index}
                className="quick-time-btn"
                onClick={() => setWhen(quickTime.value())}
                type="button"
              >
                {quickTime.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="create-form">
          <div className="input-group">
            <label className="input-label">
              <span className="label-icon">📝</span>
              Текст напоминания
            </label>
            <textarea
              className="text-input"
              placeholder="Например: Купить молоко, Позвонить маме..."
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError('')
              }}
              onKeyPress={handleKeyPress}
              rows="3"
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              <span className="label-icon">⏰</span>
              Дата и время
            </label>
            <input
              className="datetime-input"
              type="datetime-local"
              value={when}
              onChange={(e) => {
                setWhen(e.target.value)
                setError('')
              }}
              disabled={isLoading}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            className={`submit-btn ${isLoading ? 'loading' : ''} ${!text || !when ? 'disabled' : ''}`}
            onClick={handleSubmit}
            disabled={isLoading || !text || !when}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                Создание...
              </>
            ) : (
              <>
                <span className="btn-icon">➕</span>
                Создать напоминание
              </>
            )}
          </button>
        </div>

        {/* Tips */}
        <div className="create-tips">
          <div className="tip">
            <span className="tip-icon">💡</span>
            Напоминание появится в списке задач
          </div>
          <div className="tip">
            <span className="tip-icon">🎤</span>
            Или используйте голосовой ввод для быстрого создания
          </div>
        </div>
      </div>
    </div>
  )
}