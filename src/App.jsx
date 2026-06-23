import { useEffect, useMemo, useState } from 'react'
import VoicePanel from './panels/VoicePanel.jsx'
import CreatePanel from './panels/CreatePanel.jsx'
import TasksPanel from './panels/TasksPanel.jsx'
import KanbanPanel from './panels/KanbanPanel.jsx'
import CalendarPanel from './panels/CalendarPanel.jsx'
import HabitsPanel from './panels/HabitsPanel.jsx'
import SettingsPanel from './panels/SettingsPanel.jsx'
import ProfilePanel from './panels/ProfilePanel.jsx'
import AuthPanel from './panels/AuthPanel.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import UserBadge from './components/UserBadge.jsx'
import InAppNotifications from './components/InAppNotifications.jsx'
import { createReminder, deleteReminder, listReminders } from './api/reminders.js'
import { me } from './api/auth.js'

const TABS = [
  { key: 'voice', label: 'Голос' },
  { key: 'tasks', label: 'Задачи' },
  { key: 'kanban', label: 'Канбан' },
  { key: 'calendar', label: 'Календарь' },
  { key: 'habits', label: 'Привычки' },
  { key: 'create', label: 'Создать' },
  { key: 'settings', label: 'Настройки' },
  { key: 'profile', label: 'Профиль' },
]

export default function App() {
  const [items, setItems] = useState([])
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [activeTab, setActiveTab] = useState('voice')
  const [status, setStatus] = useState('Система готова к работе.')
  const [heard, setHeard] = useState('')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'
    document.documentElement.classList.toggle('light', savedTheme === 'light')
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    me()
      .then((currentUser) => {
        setUser(currentUser)
        return listReminders()
      })
      .then(setItems)
      .catch(() => {
        setUser(null)
        setItems([])
      })
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    if (!user) {
      setItems([])
      setActiveTab('voice')
    }
  }, [user])

  async function refresh() {
    if (!user) {
      setItems([])
      return
    }
    const nextItems = await listReminders()
    setItems(nextItems)
  }

  const api = useMemo(
    () => ({
      create: async (text, due) => {
        await createReminder(text, due)
        await refresh()
      },
      remove: async (id) => {
        await deleteReminder(id)
        await refresh()
      },
      refresh,
    }),
    [user]
  )

  const handleAuthed = async (currentUser) => {
    setUser(currentUser)
    setStatus(`Сессия активна: ${currentUser.email}`)
    setActiveTab('voice')
    try {
      const nextItems = await listReminders()
      setItems(nextItems)
    } catch {
      setItems([])
    }
  }

  const handleLoggedOut = () => {
    setUser(null)
    setItems([])
    setStatus('Для продолжения требуется вход в аккаунт.')
  }

  const showAuthGate = authReady && !user

  return (
    <div className="mobile-shell">
      <InAppNotifications />
      <header className="mobile-top">
        <div className="mobile-top-copy">
          <h1>ГласПлан</h1>
          <p>{user?.email || 'Авторизация обязательна для доступа к функциям приложения'}</p>
        </div>
        <div className="mobile-top-side">
          <UserBadge user={user} isLoading={!authReady} />
          <ThemeToggle />
        </div>
      </header>

      <main className="mobile-content">
        {!authReady && (
          <section className="auth-gate-shell auth-gate-shell--loading">
            <div className="auth-gate-copy">
              <span className="auth-gate-kicker">Проверка доступа</span>
              <h2>Восстанавливаем текущую сессию</h2>
              <p>Подождите несколько секунд, пока приложение проверит активный вход.</p>
            </div>
          </section>
        )}

        {showAuthGate && <AuthPanel onAuthed={handleAuthed} onLoggedOut={handleLoggedOut} />}

        {authReady && user && (
          <>
            {activeTab === 'voice' && <VoicePanel user={user} status={status} setStatus={setStatus} setHeard={setHeard} onReminderCreated={refresh} />}
            {activeTab === 'tasks' && <TasksPanel items={items} api={api} />}
            {activeTab === 'kanban' && <KanbanPanel items={items} />}
            {activeTab === 'calendar' && <CalendarPanel items={items} />}
            {activeTab === 'habits' && <HabitsPanel />}
            {activeTab === 'create' && <CreatePanel api={api} />}
            {activeTab === 'settings' && <SettingsPanel />}
            {activeTab === 'profile' && <ProfilePanel user={user} onUpdated={setUser} />}
          </>
        )}
      </main>

      {user && (
        <nav className="bottom-nav" aria-label="Главная навигация">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nav-btn ${activeTab === tab.key ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
