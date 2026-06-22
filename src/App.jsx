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
  const [activeTab, setActiveTab] = useState('voice')
  const [status, setStatus] = useState('Система готова к работе.')
  const [heard, setHeard] = useState('')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'
    document.documentElement.classList.toggle('light', savedTheme === 'light')
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    me().then(setUser).catch(() => null)
    listReminders().then(setItems).catch(() => setItems([]))
  }, [])

  async function refresh() {
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
    []
  )

  return (
    <div className="mobile-shell">
      <header className="mobile-top">
        <div>
          <h1>ГласПлан</h1>
          <p>{user?.email || 'Голосовой планировщик для телефона'}</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mobile-content">
        {activeTab === 'voice' && <VoicePanel user={user} status={status} setStatus={setStatus} setHeard={setHeard} onReminderCreated={refresh} />}
        {activeTab === 'tasks' && <TasksPanel items={items} api={api} />}
        {activeTab === 'kanban' && <KanbanPanel items={items} />}
        {activeTab === 'calendar' && <CalendarPanel items={items} />}
        {activeTab === 'habits' && <HabitsPanel />}
        {activeTab === 'create' && <CreatePanel api={api} />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'profile' && (
          user ? <ProfilePanel user={user} onUpdated={setUser} /> : <AuthPanel onAuthed={setUser} onLoggedOut={() => setUser(null)} />
        )}
      </main>

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
    </div>
  )
}
