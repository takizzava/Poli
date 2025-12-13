// src/components/UserBadge.jsx
import '../styles/user-badge.css'

/**
 * Компонент отображения информации о пользователе
 * @param {Object} user - объект пользователя { id, email }
 * @param {boolean} isLoading - состояние загрузки
 */
export default function UserBadge({ user, isLoading = false }) {
  // Если загрузка - показываем скелетон
  if (isLoading) {
    return (
      <div className="user-badge user-badge--loading">
        <div className="user-avatar user-avatar--skeleton"></div>
        <div className="user-name user-name--skeleton"></div>
      </div>
    )
  }

  // Если нет пользователя - не показываем ничего
  if (!user) {
    return null
  }

  // Извлекаем имя из email (часть до @) или используем email
  const displayName = user.email 
    ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)
    : 'Пользователь'
  
  // Инициалы для аватара (первая буква email)
  const initials = user.email 
    ? user.email.charAt(0).toUpperCase()
    : 'U'

  // Полное имя для tooltip
  const fullName = user.email || 'Пользователь'

  return (
    <div className="user-badge" title={fullName}>
      <div className="user-avatar" aria-label={`Аватар пользователя ${fullName}`}>
        {initials}
      </div>
      <span className="user-name" title={fullName}>
        {displayName}
      </span>
    </div>
  )
}

