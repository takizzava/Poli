import { useEffect, useRef, useState } from 'react'
import PushControls from '../components/PushControls.jsx'
import NotificationSettingsForm from '../components/NotificationSettingsForm.jsx'

const SKINS = [
  { id: 'classic', name: 'Classic', description: 'Сдержанный стиль с чистым контуром.' },
  { id: 'vinyl', name: 'Vinyl', description: 'Более глубокий и контрастный стиль.' },
  { id: 'neon', name: 'Neon', description: 'Яркий стиль с усиленным свечением.' },
  { id: 'minimal', name: 'Minimal', description: 'Спокойный минималистичный стиль.' },
]

export default function SettingsPanel() {
  const [skin, setSkin] = useState(localStorage.getItem('micSkin') || 'classic')
  const [isLoading, setIsLoading] = useState(false)
  const [wakeWordsInput, setWakeWordsInput] = useState(() => {
    const saved = localStorage.getItem('wakeWords')
    try {
      const arr = JSON.parse(saved || '[]')
      return Array.isArray(arr) && arr.length ? arr.join(', ') : 'поли'
    } catch {
      return 'поли'
    }
  })
  const [wakeWordsStatus, setWakeWordsStatus] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('micSkin', skin)
    window.dispatchEvent(new CustomEvent('mic-skin-changed', { detail: skin }))
  }, [skin])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleSkinChange = (nextSkin) => {
    if (nextSkin === skin) return
    setIsLoading(true)
    setSkin(nextSkin)
    clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setIsLoading(false), 280)
  }

  const saveWakeWords = () => {
    const next = wakeWordsInput
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)

    const words = next.length ? next : ['поли']
    localStorage.setItem('wakeWords', JSON.stringify(words))
    window.dispatchEvent(new CustomEvent('wake-words-changed', { detail: words }))
    setWakeWordsStatus(`Сохранено: ${words.join(', ')}`)
  }

  return (
    <div className="settings-panel">
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">ПРОФИЛЬ ВИДА</p>
            <h4>Вид микрофона</h4>
            <p className="muted">Выберите стиль кнопки микрофона. Смена применяется сразу.</p>
          </div>
        </div>

        <div className="skins-grid">
          {SKINS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`skin-card ${skin === option.id ? 'active' : ''}`}
              onClick={() => handleSkinChange(option.id)}
              disabled={isLoading}
            >
              <span className="skin-kicker">{option.id}</span>
              <strong className="skin-name">{option.name}</strong>
              <span className="skin-description">{option.description}</span>
              <span className="skin-active">{skin === option.id ? 'выбрано' : 'применить'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">ГОЛОСОВАЯ АКТИВАЦИЯ</p>
            <h4>Хот-слова</h4>
            <p className="muted">Укажите одно или несколько слов через запятую. Пример: «поли, ассистент, помощник».</p>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="wake-words-input">Список хот-слов</label>
          <input
            id="wake-words-input"
            className="field-control"
            type="text"
            value={wakeWordsInput}
            onChange={(e) => setWakeWordsInput(e.target.value)}
            placeholder="поли, ассистент"
          />
        </div>

        <div className="push-actions">
          <button type="button" className="btn" onClick={saveWakeWords}>Сохранить хот-слова</button>
        </div>
        {wakeWordsStatus ? <div className="push-message success">{wakeWordsStatus}</div> : null}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">PUSH КАНАЛ</p>
            <h4>Разрешения и тест доставки</h4>
            <p className="muted">Подключите web push и проверьте доставку без выхода из текущего экрана.</p>
          </div>
        </div>
        <PushControls />
      </section>

      <NotificationSettingsForm />
    </div>
  )
}
