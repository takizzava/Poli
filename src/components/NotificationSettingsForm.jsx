import { useEffect, useMemo, useState } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '../api/notificationSettings.js'

const TIMEZONES = ['Europe/Moscow', 'UTC', 'Europe/Kaliningrad', 'Asia/Almaty', 'Asia/Vladivostok']
const EMPTY_QUIET = { start: '22:00', end: '07:00' }

export default function NotificationSettingsForm() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const data = await getNotificationSettings()
        if (mounted) {
          setSettings(data)
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Не удалось загрузить настройки уведомлений.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const quietHours = useMemo(() => settings?.quiet_hours || [], [settings])

  const updateField = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  const updateQuietRange = (index, field, value) => {
    updateField(
      'quiet_hours',
      quietHours.map((slot, slotIndex) => (slotIndex === index ? { ...slot, [field]: value } : slot))
    )
  }

  const addQuietRange = () => updateField('quiet_hours', [...quietHours, { ...EMPTY_QUIET }])
  const removeQuietRange = (index) =>
    updateField(
      'quiet_hours',
      quietHours.filter((_, slotIndex) => slotIndex !== index)
    )

  const handleSave = async (event) => {
    event.preventDefault()
    if (!settings) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        ...settings,
        quiet_hours: quietHours.filter((slot) => slot.start && slot.end),
      }
      const updated = await updateNotificationSettings(payload)
      setSettings(updated)
      setSuccess('Настройки уведомлений сохранены.')
    } catch (saveError) {
      setError(saveError.message || 'Не удалось сохранить настройки.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="notif-card">
        <div className="notif-header">
          <div>
            <span className="eyebrow">Notification Matrix</span>
            <h4>Загружаем параметры</h4>
          </div>
        </div>
        <div className="notif-skeleton" />
      </div>
    )
  }

  if (!settings) {
    return <div className="notif-error">Не удалось получить настройки уведомлений.</div>
  }

  return (
    <form className="notif-card" onSubmit={handleSave}>
      <div className="notif-header">
        <div>
          <p className="eyebrow">Notification Matrix</p>
          <h4>Каналы доставки и режимы тишины</h4>
          <p className="notif-desc">
            Настройте, куда отправлять напоминания и когда приложение должно временно молчать.
          </p>
        </div>
        <div className="notif-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={() => window.location.reload()}
            disabled={saving}
          >
            Сбросить
          </button>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {error ? <div className="notif-alert error">{error}</div> : null}
      {!error && success ? <div className="notif-alert success">{success}</div> : null}

      <div className="notif-grid">
        <section className="notif-box notif-box--channels">
          <div className="notif-box-copy">
            <h5>Каналы доставки</h5>
            <p>Включайте только те типы уведомлений, которые реально нужны пользователю.</p>
          </div>

          <div className="channel-list">
            <label className="channel-card">
              <input
                type="checkbox"
                checked={!!settings.push_enabled}
                onChange={(event) => updateField('push_enabled', event.target.checked)}
              />
              <div>
                <strong>Web Push</strong>
                <span>Уведомления через браузер и Service Worker.</span>
              </div>
            </label>

            <label className="channel-card">
              <input
                type="checkbox"
                checked={!!settings.in_app_enabled}
                onChange={(event) => updateField('in_app_enabled', event.target.checked)}
              />
              <div>
                <strong>Внутри приложения</strong>
                <span>Локальные уведомления прямо в интерфейсе.</span>
              </div>
            </label>

            <label className="channel-card">
              <input
                type="checkbox"
                checked={!!settings.email_enabled}
                onChange={(event) => updateField('email_enabled', event.target.checked)}
              />
              <div>
                <strong>Email</strong>
                <span>Отдельный канал для уведомлений вне браузера.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="notif-box notif-box--dnd">
          <div className="notif-box-copy">
            <h5>Do Not Disturb</h5>
            <p>Ограничивает доставку в указанное окно времени по выбранному часовому поясу.</p>
          </div>

          <label className="channel-card channel-card--compact">
            <input
              type="checkbox"
              checked={!!settings.do_not_disturb_enabled}
              onChange={(event) => updateField('do_not_disturb_enabled', event.target.checked)}
            />
            <div>
              <strong>Включить режим тишины</strong>
              <span>Блокировать уведомления в основном интервале DND.</span>
            </div>
          </label>

          <div className="time-row">
            <label className="select-field">
              <span className="field-label">С</span>
              <input
                type="time"
                value={settings.do_not_disturb_start || ''}
                onChange={(event) => updateField('do_not_disturb_start', event.target.value || null)}
                disabled={!settings.do_not_disturb_enabled}
              />
            </label>
            <label className="select-field">
              <span className="field-label">До</span>
              <input
                type="time"
                value={settings.do_not_disturb_end || ''}
                onChange={(event) => updateField('do_not_disturb_end', event.target.value || null)}
                disabled={!settings.do_not_disturb_enabled}
              />
            </label>
          </div>

          <label className="select-field">
            <span className="field-label">Часовой пояс</span>
            <select
              value={settings.timezone || 'Europe/Moscow'}
              onChange={(event) => updateField('timezone', event.target.value)}
            >
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>

      <section className="notif-box notif-box--quiet">
        <div className="box-head">
          <div>
            <h5>Тихие часы</h5>
            <p>Дополнительные интервалы, в которые приложение не должно беспокоить пользователя.</p>
          </div>
          <button type="button" className="btn secondary sm" onClick={addQuietRange}>
            Добавить интервал
          </button>
        </div>

        {!quietHours.length ? (
          <div className="muted quiet-empty">
            Пока интервалов нет. Добавьте отдельное окно тишины, если базового DND недостаточно.
          </div>
        ) : (
          <div className="quiet-list">
            {quietHours.map((slot, index) => (
              <div className="quiet-row" key={`${slot.start}-${slot.end}-${index}`}>
                <label className="select-field">
                  <span className="field-label">Начало</span>
                  <input
                    type="time"
                    value={slot.start || ''}
                    onChange={(event) => updateQuietRange(index, 'start', event.target.value)}
                  />
                </label>
                <label className="select-field">
                  <span className="field-label">Конец</span>
                  <input
                    type="time"
                    value={slot.end || ''}
                    onChange={(event) => updateQuietRange(index, 'end', event.target.value)}
                  />
                </label>
                <button type="button" className="btn ghost sm" onClick={() => removeQuietRange(index)}>
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </form>
  )
}
