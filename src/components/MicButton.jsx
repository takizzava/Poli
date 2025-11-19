// src/components/MicButton.jsx
import { useEffect, useRef, useState } from 'react'
import '../styles/mic-button.css'
import '../styles/mic-skins.css'

export default function MicButton({
  listening,
  woke = false,
  onClick,
  onHold,
  className = ''
}) {
  const holdTimer = useRef(null)
  const [holding, setHolding] = useState(false)

  // <-- читаем текущий скин из LS и держим в состоянии
  const [skin, setSkin] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('micSkin')) || 'classic'
  })

  useEffect(() => {
    const handleSkin = (e) => {
      const next = e?.detail || localStorage.getItem('micSkin') || 'classic'
      setSkin(next)
    }
    window.addEventListener('mic-skin-changed', handleSkin)
    window.addEventListener('storage', handleSkin)
    return () => {
      window.removeEventListener('mic-skin-changed', handleSkin)
      window.removeEventListener('storage', handleSkin)
    }
  }, [])

  const startHold = () => {
    if (!onHold) return
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      setHolding(true)
      onHold()
    }, 400)
  }
  const endHold = () => {
    clearTimeout(holdTimer.current)
    setHolding(false)
  }

  const cls = [
    'mic',
    `skin-${skin}`,           // <-- теперь берём из state, обновится мгновенно
    listening ? 'is-on' : 'is-off',
    woke ? 'wake' : '',
    holding ? 'holding' : '',
    className
  ].join(' ')

  return (
    <button
      id="mic-btn"
      type="button"
      className={cls}
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onClick={(e) => { endHold(); onClick?.(e) }}
      aria-pressed={listening}
      aria-label={listening ? 'Поли слушает' : 'Включить микрофон'}
    >
      <span className="ring ring-1" />
      <span className="ring ring-2" />
      <span className="core" />
      <span className="label">{listening ? 'Поли слушает…' : 'Скажи «Поли»'}</span>
    </button>
  )
}
