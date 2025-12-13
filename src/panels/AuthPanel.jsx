import { useEffect, useState } from 'react'
import { login, signup, logout, me } from '../api/auth.js'
import '../styles/auth-panel.css' //

export default function AuthPanel({ onAuthed }){
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [status, setStatus] = useState('Проверка…')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login') // 'login' или 'signup'

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const u = await me()
        setUser(u)
        setStatus(`Вошли как ${u.email}`)
      } catch {
        setStatus('Не вошли')
      }
    }
    checkAuth()
  }, [])

  const handleAuth = async (authFn, action) => {
    if (!email || !pass) {
      setStatus('Заполните все поля')
      return
    }

    setIsLoading(true)
    setStatus(`${action}...`)
    
    try {
      const u = await authFn(email, pass)
      setUser(u)
      setStatus(`Успешный вход как ${u.email}`)
      onAuthed?.(u)
    } catch (e) {
      setStatus(`Ошибка ${action.toLowerCase()}: ${e.message || 'Неизвестная ошибка'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await logout()
      setUser(null)
      setStatus('Вы вышли из системы')
    } catch (e) {
      setStatus('Ошибка выхода')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-panel">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-avatar">
            {user ? '👤' : '🔐'}
          </div>
          <div className="auth-info">
            <h2 className="auth-title">Аккаунт</h2>
            <div className={`auth-status ${status.includes('Ошибка') ? 'error' : ''} ${status.includes('Успешный') ? 'success' : ''}`}>
              {status}
            </div>
          </div>
        </div>

        {!user ? (
          <div className="auth-content">
            {/* Tab Navigation */}
            <div className="auth-tabs">
              <button 
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => setActiveTab('login')}
              >
                <span className="auth-tab-icon">↳</span>
                Вход
              </button>
              <button 
                className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
                onClick={() => setActiveTab('signup')}
              >
                <span className="auth-tab-icon">+</span>
                Регистрация
              </button>
            </div>

            {/* Auth Form */}
            <div className="auth-form">
              <div className="input-group">
                <label className="input-label">Email</label>
                <input 
                  className="input-field"
                  type="email" 
                  placeholder="your@email.com"
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Пароль</label>
                <input 
                  className="input-field"
                  type="password" 
                  placeholder="Введите пароль"
                  value={pass} 
                  onChange={e => setPass(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <button 
                className={`auth-btn ${isLoading ? 'loading' : ''}`}
                onClick={() => handleAuth(
                  activeTab === 'login' ? login : signup,
                  activeTab === 'login' ? 'Вход' : 'Регистрация'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    {activeTab === 'login' ? 'Вход...' : 'Регистрация...'}
                  </>
                ) : (
                  <>
                    <span className="btn-icon">
                      {activeTab === 'login' ? '↳' : '+'}
                    </span>
                    {activeTab === 'login' ? 'Войти в аккаунт' : 'Создать аккаунт'}
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="auth-divider">
              <span>или</span>
            </div>

            {/* Quick Switch */}
            <div className="auth-switch">
              {activeTab === 'login' ? (
                <p>
                  Нет аккаунта?{' '}
                  <button 
                    className="link-btn"
                    onClick={() => setActiveTab('signup')}
                  >
                    Зарегистрироваться
                  </button>
                </p>
              ) : (
                <p>
                  Уже есть аккаунт?{' '}
                  <button 
                    className="link-btn"
                    onClick={() => setActiveTab('login')}
                  >
                    Войти
                  </button>
                </p>
              )}
            </div>
          </div>
        ) : (
          /* User Profile */
          <div className="user-profile">
            <div className="profile-info">
              <div className="profile-avatar">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="profile-details">
                <h3 className="profile-name">
                  {user.email ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : 'Пользователь'}
                </h3>
                <p className="profile-email">{user.email}</p>
              </div>
            </div>

            <div className="profile-actions">
              <button 
                className="logout-btn"
                onClick={handleLogout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner small"></div>
                    Выход...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚪</span>
                    Выйти
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}