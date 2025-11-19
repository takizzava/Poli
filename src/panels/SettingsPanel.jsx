// src/panels/SettingsPanel.jsx
import { useEffect, useRef, useState } from 'react'
import PushControls from '../components/PushControls.jsx'
import '../styles/settings-panel.css'

const SKINS = [
  { id: 'classic', name: 'Классика', icon: '🎨', description: 'Традиционный стиль' },
  { id: 'vinyl',   name: 'Винил',   icon: '💿', description: 'Ретро виниловая пластинка' },
  { id: 'neon',    name: 'Неон',    icon: '🌃', description: 'Яркие неоновые цвета' },
  { id: 'minimal', name: 'Минимал', icon: '⬜', description: 'Чистый и простой' },
]

export default function SettingsPanel () {
  const [skin, setSkin] = useState(localStorage.getItem('micSkin') || 'classic')
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef(null)

  // применяем выбранный скин глобально
  useEffect(() => {
    localStorage.setItem('micSkin', skin)

    const btn = document.getElementById('mic-btn')
    if (btn) {
      SKINS.forEach(k => btn.classList.remove('skin-' + k.id))
      btn.classList.add('skin-' + skin)
    }

    // уведомляем живые компоненты (MicButton слушает mic-skin-changed)
    window.dispatchEvent(new CustomEvent('mic-skin-changed', { detail: skin }))
    // ❌ не очищаем здесь timerRef — именно это ломало скрытие оверлея
  }, [skin])

  const handleSkinChange = (next) => {
    if (next === skin) return
    setIsLoading(true)

    // очистим старый таймер перед новым
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setSkin(next)

    // «анимационная» задержка для оверлея
    timerRef.current = setTimeout(() => {
      setIsLoading(false)
      timerRef.current = null
    }, 350)

    // страховка на случай чего-то странного (снимет лоадер через 3с)
    setTimeout(() => setIsLoading(false), 3000)
  }

  return (
    <div className="settings-panel">
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon">⚙️</div>
          <div className="settings-info">
            <h2 className="settings-title">Настройки</h2>
            <p className="settings-subtitle">Персонализируйте свой опыт</p>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h3 className="section-title">
              <span className="section-icon">🎤</span>
              Стиль микрофона
            </h3>
            <p className="section-description">Выберите внешний вид кнопки голосового управления</p>
          </div>

          <div className="skins-grid">
            {SKINS.map((opt) => (
              <div
                key={opt.id}
                className={`skin-card ${skin === opt.id ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
                onClick={() => !isLoading && handleSkinChange(opt.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !isLoading && handleSkinChange(opt.id)}
              >
                <div className="skin-preview">
                  <div className={`skin-demo skin-demo-${opt.id}`}>
                    <div className="mic-button-preview">
                      <div className="mic-icon">🎤</div>
                    </div>
                  </div>
                  {skin === opt.id && (
                    <div className="skin-active-indicator">
                      <div className="checkmark">✓</div>
                    </div>
                  )}
                </div>
                <div className="skin-info">
                  <div className="skin-name">
                    <span className="skin-icon">{opt.icon}</span>
                    {opt.name}
                  </div>
                  <div className="skin-description">{opt.description}</div>
                </div>
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="loading-overlay" aria-live="polite">
              <div className="spinner" />
              <span>Применяем стиль…</span>
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h3 className="section-title"><span className="section-icon">🔔</span>Уведомления</h3>
            <p className="section-description">Управление push-уведомлениями</p>
          </div>
          <div className="push-controls-wrapper"><PushControls /></div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h3 className="section-title"><span className="section-icon">ℹ️</span>О приложении</h3>
          </div>
          <div className="app-info">
            <div className="info-item"><span className="info-label">Версия</span><span className="info-value">1.0.0</span></div>
            <div className="info-item"><span className="info-label">Разработчик</span><span className="info-value">Поли</span></div>
            <div className="info-item"><span className="info-label">Обновлено</span><span className="info-value">{new Date().toLocaleDateString('ru-RU')}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
