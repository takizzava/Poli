import { useEffect, useState } from 'react'
import { fetchProfile, updateProfile, changePassword, uploadAvatar, fetchStats } from '../api/profile.js'
import '../styles/profile-panel.css'

export default function ProfilePanel({ user, onBack, onUpdated }) {
  const [profile, setProfile] = useState(user || null)
  const [displayName, setDisplayName] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', repeat: '' })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [p, s] = await Promise.all([
          fetchProfile().catch(() => null),
          fetchStats().catch(() => null)
        ])
        if (p) {
          setProfile(p)
          setDisplayName(p.display_name || '')
          setAvatarPreview(p.avatar_url || '')
          onUpdated?.(p)
        }
        if (s) setStats(s)
      } catch (e) {
        console.error('[profile] load failed', e)
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSaveName = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateProfile(displayName)
      setProfile(updated)
      onUpdated?.(updated)
      setMessage('Имя успешно обновлено')
    } catch (e) {
      setError('Не удалось обновить имя')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (file) => {
    if (!file) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await uploadAvatar(file)
      setProfile(updated)
      onUpdated?.(updated)
      setAvatarPreview(updated.avatar_url || '')
      setMessage('Аватар успешно обновлен')
    } catch (e) {
      setError('Не удалось загрузить аватар')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordForm.current || !passwordForm.next) {
      setError('Пожалуйста заполните все поля')
      return
    }
    if (passwordForm.next !== passwordForm.repeat) {
      setError('Пароли не совпадают')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await changePassword(passwordForm.current, passwordForm.next)
      setPasswordForm({ current: '', next: '', repeat: '' })
      setMessage('Пароль успешно изменен')
    } catch (e) {
      setError('Не удалось изменить пароль')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-panel">
      <div className="panel-header">
        <div>
          <h2>Профиль</h2>
          <p className="muted">Управление профилем пользователя</p>
        </div>
        <div className="panel-actions">
          {onBack && <button className="btn outline" onClick={onBack}>Назад</button>}
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert danger">{error}</div>}

      <div className="profile-grid">
        <div className="card">
          <div className="card-title">Основное</div>
          {loading ? (
            <div className="muted">Загрузка...</div>
          ) : (
            <div className="profile-form">
              <label className="form-label">Email</label>
              <input className="input" value={profile?.email || ''} disabled />

              <label className="form-label">Имя и фамилия</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Как вас зовут?"
              />
              <button className="btn" onClick={handleSaveName} disabled={saving}>Сохранить</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Аватар</div>
          <div className="avatar-block">
            <div className="avatar-preview">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Аватар" />
              ) : (
                <div className="avatar-placeholder">??</div>
              )}
            </div>
            <div className="avatar-actions">
              <label className="btn outline">
                Загрузить
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
              <p className="muted">PNG/JPG, до 2МБ</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Пароль</div>
          <div className="profile-form">
            <label className="form-label">Текущий пароль</label>
            <input
              className="input"
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            />
            <label className="form-label">Новый пароль</label>
            <input
              className="input"
              type="password"
              value={passwordForm.next}
              onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
            />
            <label className="form-label">Повторите новый пароль</label>
            <input
              className="input"
              type="password"
              value={passwordForm.repeat}
              onChange={(e) => setPasswordForm({ ...passwordForm, repeat: e.target.value })}
            />
            <button className="btn" onClick={handlePasswordChange} disabled={saving}>Сменить пароль</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Статистика</div>
          {stats ? (
            <div className="stats-grid">
              <Stat label="Всего задач" value={stats.total} />
              <Stat label="Выполнено" value={stats.done} />
              <Stat label="Активные" value={stats.active} />
              <Stat label="Просроченные" value={stats.overdue} />
              <Stat label="За 7 дней" value={stats.done_7d} />
              <Stat label="За 30 дней" value={stats.done_30d} />
            </div>
          ) : (
            <div className="muted">Нет данных</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
