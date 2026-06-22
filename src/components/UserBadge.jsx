export default function UserBadge({ user, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="user-badge user-badge--loading">
        <div className="user-avatar user-avatar--skeleton" />
        <div className="user-copy">
          <div className="user-name user-name--skeleton" />
          <div className="user-role user-name--skeleton short" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="user-badge guest">
        <div className="user-avatar">Г</div>
        <div className="user-copy">
          <span className="user-name">Гостевой режим</span>
          <span className="user-role">Ограниченный доступ</span>
        </div>
      </div>
    )
  }

  const nickname = user.email?.split('@')[0] || 'Пользователь'
  const initials = nickname.charAt(0).toUpperCase()

  return (
    <div className="user-badge" title={user.email}>
      <div className="user-avatar">{initials}</div>
      <div className="user-copy">
        <span className="user-name">{nickname}</span>
        <span className="user-role">Авторизован</span>
      </div>
    </div>
  )
}
