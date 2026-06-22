import { useEffect, useState } from 'react'
import { listTokens, createToken, deleteToken } from '../api/apiTokens.js'
import '../styles/api-integration.css'

const STORAGE_KEY = 'apiIntegration.settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export default function ApiIntegrationPanel({ onBack }) {
  const stored = loadSettings()
  const [baseUrl, setBaseUrl] = useState(stored.baseUrl || window.location.origin)
  const [webhookUrl, setWebhookUrl] = useState(stored.webhookUrl || '')
  const [enabled, setEnabled] = useState(Boolean(stored.enabled))
  const [logRequests, setLogRequests] = useState(stored.logRequests ?? true)
  const [tokens, setTokens] = useState([])
  const [newTokenName, setNewTokenName] = useState('')
  const [lastCreatedToken, setLastCreatedToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const list = await listTokens()
        setTokens(list)
      } catch (e) {
        console.error('[api] tokens load failed', e)
        setError('Не удалось загрузить токены')
      }
    }
    load()
  }, [])

  const persist = () => {
    const payload = { baseUrl, webhookUrl, enabled, logRequests }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  const handleSave = () => {
    setSaving(true)
    setError('')
    try {
      persist()
      setTestResult('Настройки успешно сохранены')
    } catch (e) {
      setError('Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    const data = loadSettings()
    setBaseUrl(data.baseUrl || window.location.origin)
    setWebhookUrl(data.webhookUrl || '')
    setEnabled(Boolean(data.enabled))
    setLogRequests(data.logRequests ?? true)
    setTestResult('Отменено')
  }

  const handleTest = async () => {
    setTesting(true)
    setError('')
    setTestResult('')
    try {
      const target = `${(baseUrl || '').replace(/\/$/, '') || ''}/api/_debug`
      const r = await fetch(target, { credentials: 'include' })
      if (!r.ok) throw new Error('bad status')
      await r.json().catch(() => ({}))
      setTestResult('Тестирование прошло успешно')
    } catch (e) {
      setError('Не удалось выполнить тест')
    } finally {
      setTesting(false)
    }
  }

  const handleCreateToken = async () => {
    setError('')
    try {
      const created = await createToken(newTokenName || 'integration')
      setTokens((prev) => [created, ...prev])
      setLastCreatedToken(created.token || '')
      setNewTokenName('')
    } catch (e) {
      setError('Не удалось создать токен')
    }
  }

  const handleDelete = async (id) => {
    setError('')
    try {
      await deleteToken(id)
      setTokens((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError('Не удалось удалить токен')
    }
  }

  return (
    <div className="api-panel">
      <div className="panel-header">
        <div>
          <h2>API Интеграция</h2>
          <p className="muted">Настройка работы API и интеграций</p>
        </div>
        <div className="panel-actions">
          {onBack && <button className="btn outline" onClick={onBack}>Назад</button>}
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}
      {testResult && !error && <div className="alert success">{testResult}</div>}

      <div className="card">
        <div className="card-title">Основные настройки</div>
        <div className="api-grid">
          <div className="field">
            <label className="form-label">Base URL</label>
            <input className="input" value={baseUrl} onChange={(e)=>setBaseUrl(e.target.value)} />
            <p className="muted">Пример: https://example.com</p>
          </div>
          <div className="field">
            <label className="form-label">Webhook / Callback URL</label>
            <input className="input" value={webhookUrl} onChange={(e)=>setWebhookUrl(e.target.value)} />
            <p className="muted">URL для получения уведомлений</p>
          </div>
        </div>
        <div className="toggles">
          <label className="toggle">
            <input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} />
            <span>Включено</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={logRequests} onChange={(e)=>setLogRequests(e.target.checked)} />
            <span>Логировать запросы</span>
          </label>
        </div>
        <div className="actions-row">
          <button className="btn" onClick={handleSave} disabled={saving}>Сохранить</button>
          <button className="btn outline" onClick={handleCancel}>Отменить</button>
          <button className="btn secondary" onClick={handleTest} disabled={testing}>Тестировать</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Токены</div>
        <div className="token-create">
          <input
            className="input"
            placeholder="Название токена"
            value={newTokenName}
            onChange={(e)=>setNewTokenName(e.target.value)}
          />
          <button className="btn" onClick={handleCreateToken}>Создать</button>
        </div>
        {lastCreatedToken && (
          <div className="token-hint">Создан токен: <code>{lastCreatedToken}</code> сохраните его для дальнейшего использования</div>
        )}
        <div className="token-list">
          {tokens.length === 0 && <div className="muted">Токены отсутствуют</div>}
          {tokens.map((t) => (
            <div key={t.id} className="token-item">
              <div>
                <div className="token-name">{t.name || 'Без названия'}</div>
                <div className="token-meta muted">Создан: {new Date(t.created_at).toLocaleString()}</div>
                {t.last_used_at && <div className="token-meta muted">Последнее использование: {new Date(t.last_used_at).toLocaleString()}</div>}
              </div>
              <div className="token-actions">
                {t.token && <code className="token-inline">{t.token}</code>}
                <button className="btn outline" onClick={()=>handleDelete(t.id)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Встраиваемые</div>
        <p className="muted">Встраиваемые URL с параметром <code>?embed=1</code> для вставки в iframe. Встраиваемые URL используют cookie и заголовок Authorization из основного окна.</p>
      </div>
    </div>
  )
}
