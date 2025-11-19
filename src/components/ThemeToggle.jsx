// src/components/ThemeToggle.jsx
import { useEffect, useState } from 'react'
import '../styles/theme.css'

export default function ThemeToggle() {
  // начальное значение: берем из LS, иначе — из media query
  const prefersLight =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: light)').matches

  const [isLight, setIsLight] = useState(() => {
    const saved = localStorage.getItem('theme')
    return (saved ? saved === 'light' : prefersLight)
  })

  // применяем тему к документу и мета-цвету
  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight)
    localStorage.setItem('theme', isLight ? 'light' : 'dark')
    const meta = document.querySelector('meta[name=theme-color]')
    if (meta) meta.setAttribute('content', isLight ? '#f8fafc' : '#0b1020')
  }, [isLight])

  return (
    <button
      className={`theme-toggle ${isLight ? 'light' : 'dark'}`}
      onClick={() => setIsLight(v => !v)}
      aria-label="Переключить тему"
    >
      <div className="theme-toggle-inner">
        <span className="theme-icon">{isLight ? '☀️' : '🌙'}</span>
      </div>
    </button>
  )
}
