import { useEffect, useRef, useState } from 'react'

export default function MicButton({ listening, woke = false, mode = 'idle', voiceLevel = 0, onClick, onHold, className = '' }) {
  const holdTimerRef = useRef(null)
  const [holding, setHolding] = useState(false)
  const [skin, setSkin] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('micSkin') || 'classic' : 'classic'
  )

  useEffect(() => {
    const handleSkinChange = (event) => {
      setSkin(event?.detail || localStorage.getItem('micSkin') || 'classic')
    }
    window.addEventListener('mic-skin-changed', handleSkinChange)
    window.addEventListener('storage', handleSkinChange)
    return () => {
      window.removeEventListener('mic-skin-changed', handleSkinChange)
      window.removeEventListener('storage', handleSkinChange)
    }
  }, [])

  const startHold = () => {
    if (!onHold) return
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = window.setTimeout(() => {
      setHolding(true)
      onHold()
    }, 420)
  }

  const endHold = () => {
    clearTimeout(holdTimerRef.current)
    setHolding(false)
  }

  const classes = ['mic', `skin-${skin}`, `mode-${mode}`, listening ? 'is-on' : 'is-off', woke ? 'wake' : '', holding ? 'holding' : '', className]
    .filter(Boolean)
    .join(' ')

  const label =
    mode === 'capture'
      ? 'Говорите'
      : mode === 'armed'
        ? 'Жду хот-слово'
        : listening
          ? 'Микрофон включен'
          : holding
            ? 'Фиксация'
            : 'Нажмите для записи'

  return (
    <button
      id="mic-btn"
      type="button"
      className={classes}
      style={{ '--voice-level': String(voiceLevel) }}
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onClick={(event) => {
        endHold()
        onClick?.(event)
      }}
      aria-pressed={listening}
      aria-label={listening ? 'Остановить запись' : 'Запустить запись'}
    >
      <span className="ambient ambient-1" aria-hidden="true" />
      <span className="ambient ambient-2" aria-hidden="true" />
      <span className="core"><span className="core-pulse" /></span>
      <span className="label">{label}</span>
      {woke && <span className="wake-flash" aria-hidden="true" />}
    </button>
  )
}
