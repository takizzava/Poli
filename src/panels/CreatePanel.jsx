import { useState } from 'react'

const QUICK_TIMES = [
  {
    label: 'Через 1 час',
    description: 'Срочное напоминание',
    value: () => formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
  },
  {
    label: 'Сегодня 20:00',
    description: 'Вечерний слот',
    value: () => {
      const date = new Date()
      date.setHours(20, 0, 0, 0)
      if (date < new Date()) date.setDate(date.getDate() + 1)
      return formatDateTimeLocal(date)
    },
  },
  {
    label: 'Завтра 09:00',
    description: 'Утренний слот',
    value: () => {
      const date = new Date()
      date.setDate(date.getDate() + 1)
      date.setHours(9, 0, 0, 0)
      return formatDateTimeLocal(date)
    },
  },
]

export default function CreatePanel({ api }) {
  const [text, setText] = useState('')
  const [when, setWhen] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Введите текст задачи.')
      setSuccess('')
      return
    }

    if (!when) {
      setError('Выберите дату и время.')
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setIsLoading(true)

    try {
      await api.create(text.trim(), new Date(when).getTime())
      setText('')
      setWhen('')
      setSuccess('Напоминание сохранено.')
    } catch (submissionError) {
      console.error('Create error:', submissionError)
      setError('Сохранить задачу не удалось.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="create-panel">
      <div className="quick-band">
        {QUICK_TIMES.map((quickTime) => (
          <button
            key={quickTime.label}
            type="button"
            className="band-btn"
            onClick={() => {
              setWhen(quickTime.value())
              setError('')
            }}
            disabled={isLoading}
          >
            <strong>{quickTime.label}</strong>
            <span>{quickTime.description}</span>
          </button>
        ))}
      </div>

      <label className="field">
        <span className="label">Текст задачи</span>
        <textarea
          className="field-control"
          placeholder="Например: встретиться с аналитиками и утвердить план запуска."
          value={text}
          rows={4}
          onChange={(event) => {
            setText(event.target.value)
            setError('')
            setSuccess('')
          }}
          disabled={isLoading}
        />
      </label>

      <label className="field">
        <span className="label">Когда напомнить</span>
        <input
          className="field-control"
          type="datetime-local"
          value={when}
          min={formatDateTimeLocal(new Date())}
          onChange={(event) => {
            setWhen(event.target.value)
            setError('')
            setSuccess('')
          }}
          disabled={isLoading}
        />
      </label>

      <div className="form-footer">
        <div className="form-messages">
          {error ? <div className="error">{error}</div> : null}
          {!error && success ? <div className="success-note">{success}</div> : null}
        </div>

        <button
          type="button"
          className="primary"
          onClick={handleSubmit}
          disabled={isLoading || !text.trim() || !when}
        >
          {isLoading ? 'Сохраняем...' : 'Создать напоминание'}
        </button>
      </div>
    </div>
  )
}

function formatDateTimeLocal(date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}
