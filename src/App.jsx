import { useEffect, useMemo, useState } from 'react'
import VoicePanel from './panels/VoicePanel.jsx'
import CreatePanel from './panels/CreatePanel.jsx'
import TasksPanel from './panels/TasksPanel.jsx'
import SettingsPanel from './panels/SettingsPanel.jsx'
import AuthPanel from './panels/AuthPanel.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import UserBadge from './components/UserBadge.jsx'
import { listReminders, createReminder, deleteReminder } from './api/reminders.js'
import { me } from './api/auth.js'

const TABS = [
  { id: 'voice', icon: '🎤', label: 'Голос' },
  { id: 'create', icon: '➕', label: 'Создать' },
  { id: 'tasks', icon: '🗂', label: 'Задачи' },
  { id: 'settings', icon: '⚙️', label: 'Настройки' },
  { id: 'auth', icon: '🔐', label: 'Аккаунт' }
]

export default function App(){
  const [tab, setTab] = useState('voice')
  const [status, setStatus] = useState('Готова. Скажи «Поли».')
  const [heard, setHeard] = useState('')
  const [items, setItems] = useState([])
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const saved = localStorage.getItem('theme') || 'dark'
        document.documentElement.classList.toggle('light', saved === 'light')
        
        const [userData, remindersData] = await Promise.all([
          me().catch(() => null),
          listReminders().catch(() => [])
        ])
        
        setUser(userData)
        setItems(remindersData)
        
        // Service Worker setup for push notifications
        if ('serviceWorker' in navigator){
          navigator.serviceWorker.addEventListener('message', (e)=>{
            if (e?.data?.type === 'edi-push'){
              const d = e.data.data || {}
              setStatus('🔔 '+(d.title||'Пуш')+': '+(d.body||''))
            }
          })
        }
      } catch (error) {
        console.error('Initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [])

  async function refresh(){ 
    try {
      const updatedItems = await listReminders()
      setItems(updatedItems)
    } catch (error) {
      console.error('Refresh error:', error)
    }
  }

  const api = useMemo(() => ({
    create: async (text, due) => { 
      await createReminder(text, due); 
      await refresh() 
    },
    remove: async (id) => { 
      await deleteReminder(id); 
      await refresh() 
    }
  }), [])

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <div className="loading-text">Загружаем Поли...</div>
        </div>
      </div>
    )
  }

  return (
<div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="brand">
            <div className="logo-wrapper">
              <div className="logo"></div>
              <div className="brand-gradient"></div>
            </div>
            <div className="brand-text">
              <div className="title">Поли</div>
              <div className="subtitle">Умный голосовой помощник</div>
            </div>
          </div>

          <div className="header-controls">
            <ThemeToggle />
            <UserBadge user={user} isLoading={isLoading} />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="navigation">
        <div className="nav-container">
          {TABS.map(({ id, icon, label }) => (
            <button 
              key={id}
              className={`nav-tab ${tab === id ? 'nav-tab--active' : ''}`}
              onClick={() => setTab(id)}
              aria-selected={tab === id}
            >
              <span className="nav-tab__icon">{icon}</span>
              <span className="nav-tab__label">{label}</span>
              <div className="nav-tab__indicator"></div>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="main">
        <div className="main-container">
          {tab === 'voice' && (
            <VoicePanel 
              status={status} 
              setStatus={setStatus} 
              heard={heard} 
              setHeard={setHeard} 
            />
          )}
          {tab === 'create' && <CreatePanel api={api} />}
          {tab === 'tasks' && <TasksPanel items={items} api={api} />}
          {tab === 'settings' && <SettingsPanel />}
          {tab === 'auth' && (
            <AuthPanel 
              onAuthed={(u) => { 
                setUser(u); 
                setTab('voice'); 
              }} 
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-info">
            <div className="app-version">v1.0.0</div>
            <div className="copyright">© {new Date().getFullYear()} Поли</div>
          </div>
          <div className="status-bar">
            <div className={`status-indicator ${status.includes('🔔') ? 'status-indicator--notification' : ''}`}>
              {status}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}