// src/components/SkinSwitcher.jsx
import './skin-switcher.css'

const SKINS = ['classic', 'vinyl', 'neon', 'minimal']

export default function SkinSwitcher({ skin, onChange }) {
  const current = skin || localStorage.getItem('micSkin') || 'classic'

  const apply = (s) => {
    if (s === current) return
    try {
      localStorage.setItem('micSkin', s)
      // Пометим кнопку, если она уже в DOM (id="mic-btn")
      const btn = document.getElementById('mic-btn')
      if (btn) {
        SKINS.forEach(k => btn.classList.remove('skin-' + k))
        btn.classList.add('skin-' + s)
      }
      // Сообщим всем, кто слушает
      window.dispatchEvent(new CustomEvent('mic-skin-changed', { detail: s }))
    } finally {
      onChange?.(s)
    }
  }

  return (
    <div className="skin-switcher">
      {SKINS.map((s) => (
        <button
          key={s}
          type="button"
          data-skin={s}
          className={s === current ? 'active' : ''}
          aria-pressed={s === current}
          aria-label={`Скин ${s}`}
          title={s}
          onClick={() => apply(s)}
        />
      ))}
    </div>
  )
}
