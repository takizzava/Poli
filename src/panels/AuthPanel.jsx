import { useEffect, useState } from 'react'
import { login, logout, me, signup } from '../api/auth.js'

export default function AuthPanel({ onAuthed, onLoggedOut }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('Проверяем состояние сессии...')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('login')

  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await me()
        setUser(currentUser)
        setStatus(`Сессия активна: ${currentUser.email}`)
      } catch {
        setStatus('Вход не выполнен.')
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [])

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setStatus('Заполните email и пароль.')
      return
    }

    setIsLoading(true)
    setStatus(activeTab === 'login' ? 'Выполняем вход...' : 'Создаем аккаунт...')

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
    <div className="auth-panel">
      <div className="auth-status">{status}</div>

      {!user ? (
        <div className="auth-box">
          <div className="auth-tabs">
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
              />
            </label>

            <label className="auth-field">
              <span>Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
              />
            </label>

            <button type="button" className="auth-action" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Обрабатываем...' : activeTab === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </div>
        </div>
      ) : (
        <div className="auth-box user">
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
  )
}
