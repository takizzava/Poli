import { useState } from 'react'
import { login, logout, signup } from '../api/auth.js'

const AUTH_COPY = {
  login: {
    eyebrow: 'Безопасный вход',
    title: 'Авторизуйтесь, чтобы открыть рабочее пространство',
    description: 'После входа станут доступны голосовой помощник, задачи, календарь и персональные настройки.',
    button: 'Войти',
    loading: 'Выполняем вход...',
  },
  signup: {
    eyebrow: 'Новый аккаунт',
    title: 'Создайте аккаунт и сохраните данные в своей сессии',
    description: 'Регистрация сразу открывает доступ ко всем функциям приложения и включает персональное хранение.',
    button: 'Создать аккаунт',
    loading: 'Создаём аккаунт...',
  },
}

export default function AuthPanel({ onAuthed, onLoggedOut }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('Войдите или зарегистрируйтесь, чтобы продолжить работу.')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')

  const view = AUTH_COPY[activeTab]

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setStatus('Заполните email и пароль.')
      return
    }

    setIsLoading(true)
    setStatus(view.loading)

    try {
      const currentUser =
        activeTab === 'login'
          ? await login(email.trim(), password)
          : await signup(email.trim(), password)

      setUser(currentUser)
      setStatus(`Готово: ${currentUser.email}`)
      onAuthed?.(currentUser)
    } catch (error) {
      setStatus(`Ошибка: ${error.message || 'операция не выполнена'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    setStatus('Завершаем сессию...')

    try {
      await logout()
      setUser(null)
      setStatus('Вы вышли из аккаунта.')
      onLoggedOut?.()
    } catch {
      setStatus('Не удалось выйти из аккаунта.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="auth-panel">
      <div className="auth-box auth-hero">
        <div className="auth-copy">
          <span className="auth-kicker">{view.eyebrow}</span>
          <h2>{view.title}</h2>
          <p>{view.description}</p>
        </div>

        <div className="auth-status" role="status" aria-live="polite">
          {status}
        </div>

        {!user ? (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Режим авторизации">
              <button
                type="button"
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => setActiveTab('login')}
                disabled={isLoading}
              >
                Вход
              </button>
              <button
                type="button"
                className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
                onClick={() => setActiveTab('signup')}
                disabled={isLoading}
              >
                Регистрация
              </button>
            </div>

            <div className="auth-form">
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </label>

              <label className="auth-field">
                <span>Пароль</span>
                <input
                  type="password"
                  placeholder="Не менее 6 символов"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                />
              </label>

              <button type="button" className="auth-action" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Обрабатываем...' : view.button}
              </button>
            </div>

            <div className="auth-note">
              Все рабочие панели скрыты, пока не выполнен вход. Это защищает персональные данные и историю напоминаний.
            </div>
          </>
        ) : (
          <div className="auth-box auth-box-user">
            <div className="user-line">
              <div className="user-avatar">{user.email?.[0]?.toUpperCase() || 'U'}</div>
              <div>
                <div className="user-name">{user.email}</div>
                <div className="muted">Активная серверная сессия</div>
              </div>
            </div>
            <button type="button" className="auth-action ghost" onClick={handleLogout} disabled={isLoading}>
              {isLoading ? '...' : 'Выйти'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
