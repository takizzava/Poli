// src/panels/VoicePanel.jsx
import { useEffect, useRef, useState } from 'react'
import MicButton from '../components/MicButton.jsx'
import { useSpeech } from '../speech/useSpeech.js'
import { parse, formatDueSpoken } from '../utils/parser.js'
import { askAI } from '../api/ai.js'
import { createReminder } from '../api/reminders.js'
import '../styles/voice-panel.css'

// надёжный уникальный id
const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `m_${Date.now()}_${(uid.c = (uid.c || 0) + 1)}`

export default function VoicePanel({ status, setStatus, heard, setHeard }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [woke, setWoke] = useState(false)
  const [messages, setMessages] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)

  const didWelcome = useRef(false)
  const chatRef = useRef(null)

  // мягкий автоскролл вниз, когда приходят новые сообщения или interim
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    // requestAnimationFrame, чтобы дождаться отрисовки
    const raf = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [messages, interim])

  const isReminder = (s = '') => {
    const t = s.toLowerCase()
    return (
      t.includes('напомни') ||
      t.includes('напоминан') ||
      t.includes('создай напомин') ||
      t.includes('добавь напомин')
    )
  }

  // добавление финальных сообщений в ленту
  const addMessage = (text, type = 'user') => {
    if (!text) return
    setMessages((prev) => [...prev, { id: uid(), text, type }])
  }

  const speech = useSpeech({
    onInterim: (text) => {
      // interim выводим отдельно (не в messages) — никаких дублей и key-ворнингов
      setInterim(text || '')
      setHeard?.(text || '')
    },
    onFinal: async (text) => {
      setInterim('')
      setHeard?.(text || '')
      if (!text) return

      // финальная фраза пользователя
      addMessage(text, 'user')

      setIsProcessing(true)

      if (isReminder(text)) {
        const p = parse(text, new Date())
        if (!p) {
          const errorMsg =
            'Не поняла дату/время. Скажи, например: «завтра в 12 купить хлеб».'
          setStatus?.(errorMsg)
          addMessage(errorMsg, 'assistant')
          setIsProcessing(false)
          return
        }

        const creatingMsg = `Создаю напоминание ${formatDueSpoken(p.due)}: ${p.task}`
        setStatus?.(creatingMsg)
        addMessage(creatingMsg, 'assistant')

        try {
          await createReminder(p.task, p.due.getTime())
          const successMsg = `✅ Создала напоминание: «${p.task}» на ${formatDueSpoken(
            p.due
          )}`
          setStatus?.(successMsg)
          addMessage(successMsg, 'assistant')
        } catch (e) {
          const msg = String(e?.message || '')
          console.error('[createReminder]', msg)
          const errorMsg = msg.includes('401')
            ? '🔐 Нужно войти в аккаунт'
            : '❌ Не удалось создать напоминание'
          setStatus?.(errorMsg)
          addMessage(errorMsg, 'assistant')
        }
      } else {
        // Ответ ИИ (если ИИ пока не подключён — отловим ошибку и покажем сообщение)
        setStatus?.('🤔 Думаю над ответом…')
        try {
          const { reply } = await askAI(text)
          const aiResponse = reply || 'Готово.'
          setStatus?.(aiResponse)
          addMessage(aiResponse, 'assistant')
        } catch {
          const errorMsg = '❌ Извините, ответ сейчас недоступен.'
          setStatus?.(errorMsg)
          addMessage(errorMsg, 'assistant')
        }
      }

      setIsProcessing(false)
    },
    onStart: () => {
      setListening(true)
      setStatus?.('🎤 Слушаю... Скажи «Поли» для активации')
    },
    onStop: () => {
      setListening(false)
      setStatus?.('Готов к работе')
      setInterim('')
    },
    onWake: () => {
      setWoke(true)
      setTimeout(() => setWoke(false), 650)
      setStatus?.('👂 Говори команду…')
      // маленькая «подсказка» от ассистента
      addMessage('👂 Слушаю вашу команду...', 'assistant')
    },
  })

  // единоразовое приветствие (без дублей при HMR)
  useEffect(() => {
    if (didWelcome.current) return
    didWelcome.current = true
    const welcomeMsg =
      'Привет! Я Поли. Нажми на микрофон и скажи: «Поли, напомни завтра в двенадцать купить хлеб».'
    setStatus?.(welcomeMsg)
    addMessage(welcomeMsg, 'assistant')
  }, [])

  const clearChat = () => {
    setMessages([])
    setHeard?.('')
    setInterim('')
  }

  return (
    <div className="voice-panel">
      <div className="voice-card">
        {/* Header */}
        <div className="voice-header">
          <div className="voice-title-section">
            <div className="voice-icon">🎤</div>
            <div>
              <h2 className="voice-title">Голосовой помощник</h2>
              <p className="voice-subtitle">Общайтесь с Поли голосом</p>
            </div>
          </div>

          <button
            className="clear-chat-btn"
            onClick={clearChat}
            disabled={messages.length === 0 && !interim}
            title="Очистить историю"
          >
            <span className="clear-icon">🗑️</span>
            Очистить
          </button>
        </div>

        {/* Status Bar */}
        <div className="voice-status-bar">
          <div className="status-indicator">
            <div
              className={`status-dot ${listening ? 'listening' : ''} ${
                isProcessing ? 'processing' : ''
              }`}
            />
            <span className="status-text">
              {status || (listening ? 'Слушаю...' : 'Готов к работе')}
            </span>
          </div>
        </div>

        {/* Chat */}
        <div className="voice-chat" ref={chatRef}>
          {messages.length === 0 && !interim ? (
            <div className="empty-chat">
              <div className="empty-chat-icon">🎯</div>
              <h3 className="empty-chat-title">Начните разговор с Поли</h3>
              <p className="empty-chat-description">
                Нажмите на микрофон и скажите команду. Например:
              </p>
              <div className="example-commands">
                <div className="example-command">
                  «Поли, напомни завтра в 12 купить хлеб»
                </div>
                <div className="example-command">
                  «Создай напоминание на пятницу встречу с друзьями»
                </div>
                <div className="example-command">«Сколько будет 2+2?»</div>
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message ${
                    message.type === 'user' ? 'user-message' : 'assistant-message'
                  }`}
                >
                  <div className="message-avatar">
                    {message.type === 'user' ? '👤' : ''}
                  </div>
                  <div className="message-content">
                    <div className="message-bubble">{message.text}</div>
                    <div className="message-time">
                      {new Date().toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Эфемерный typing-пузырь пользователя */}
              {interim && (
                <div className="chat-message user-message typing-message" key="__typing">
                  <div className="message-avatar">👤</div>
                  <div className="message-content">
                    <div className="message-bubble">
                      {interim}
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="message-time">
                      {new Date().toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Индикация «думаю» — когда ждём ответ ИИ */}
              {isProcessing && !interim && (
                <div className="chat-message assistant-message" key="__thinking">
                  <div className="message-avatar" />
                  <div className="message-content">
                    <div className="message-bubble">
                      🤔 Думаю над ответом…
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Microphone Button */}
        <div className="mic-container">
          <MicButton
            listening={listening}
            woke={woke}
            onClick={() =>
              listening
                ? speech.stop()
                : (window.__poliPrimeAudio && window.__poliPrimeAudio(), speech.start())
            }
            onHold={async () => {
              if (!listening) speech.start()
              speech.forceCapture()
            }}
          />
        </div>

        {/* Browser Support Warning */}
        {!speech.supported && (
          <div className="browser-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>Ваш браузер не поддерживает голосовой ввод</strong>
              <br />
              Попробуйте использовать Chrome, Edge или Safari
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
