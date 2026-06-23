import { useEffect, useRef, useState } from 'react'
import MicButton from '../components/MicButton.jsx'
import { SPEECH_STATE, useSpeech } from '../speech/useSpeech.js'
import { formatDueSpoken, parse } from '../utils/parser.js'
import { askAI } from '../api/ai.js'
import { createReminder } from '../api/reminders.js'

const VOICE_MESSAGES_KEY = 'voicePanelMessages'
const VOICE_LAST_TEXT_KEY = 'voicePanelLastText'
const VOICE_TRANSCRIPT_KEY = 'voicePanelTranscriptText'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${(uid.counter = (uid.counter || 0) + 1)}`

function loadSavedMessages(fallback) {
  try {
    const raw = localStorage.getItem(VOICE_MESSAGES_KEY)
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) && parsed.length ? parsed : fallback
  } catch {
    return fallback
  }
}

export default function VoicePanel({ status, setStatus, setHeard, onReminderCreated }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [woke, setWoke] = useState(false)
  const [messages, setMessages] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [skin, setSkin] = useState(() => localStorage.getItem('micSkin') || 'classic')
  const [voiceLevel, setVoiceLevel] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [speechState, setSpeechState] = useState(SPEECH_STATE.IDLE)
  const [lastCreated, setLastCreated] = useState(null)
  const [taskFlash, setTaskFlash] = useState(false)
  const [transcriptText, setTranscriptText] = useState('')
  const chatRef = useRef(null)
  const taskFlashRef = useRef(null)

  useEffect(() => {
    const handler = (event) => setSkin(event?.detail || localStorage.getItem('micSkin') || 'classic')
    window.addEventListener('mic-skin-changed', handler)
    return () => window.removeEventListener('mic-skin-changed', handler)
  }, [])

  useEffect(() => {
    const ok = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    setSpeechSupported(ok)
    const welcome = ok ? 'Скажи: «Напомни завтра в 10 оплатить счет».' : 'Этот браузер не поддерживает SpeechRecognition.'
    setStatus?.(welcome)
    setMessages(loadSavedMessages([{ id: uid(), text: welcome, type: 'assistant', meta: 'система' }]))
    const savedHeard = localStorage.getItem(VOICE_LAST_TEXT_KEY) || ''
    const savedTranscript = localStorage.getItem(VOICE_TRANSCRIPT_KEY) || ''
    setHeard?.(savedHeard)
    setTranscriptText(savedTranscript || savedHeard)
  }, [])

  useEffect(() => {
    const node = chatRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, interim, isProcessing])

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_MESSAGES_KEY, JSON.stringify(messages.slice(-40)))
    } catch {}
  }, [messages])

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_LAST_TEXT_KEY, interim || '')
    } catch {}
  }, [interim])

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_TRANSCRIPT_KEY, transcriptText || '')
    } catch {}
  }, [transcriptText])

  useEffect(() => () => window.clearTimeout(taskFlashRef.current), [])

  const append = (text, type, meta = '') => setMessages((m) => [...m, { id: uid(), text, type, meta }])
  const isReminderIntent = (v = '') => /\b(напомни|добавь|создай|поставь|запиши)\b/.test(v.toLowerCase())
  const pulseTaskFlash = () => {
    window.clearTimeout(taskFlashRef.current)
    setTaskFlash(true)
    taskFlashRef.current = window.setTimeout(() => setTaskFlash(false), 820)
  }

  const speech = useSpeech({
    onInterim: (text) => {
      const nextText = text || ''
      setInterim(nextText)
      setTranscriptText(nextText)
      setHeard?.(nextText)
      try {
        localStorage.setItem(VOICE_LAST_TEXT_KEY, nextText)
        localStorage.setItem(VOICE_TRANSCRIPT_KEY, nextText)
      } catch {}
    },
    onFinal: async (text) => {
      setInterim('')
      setTranscriptText(text || '')
      setHeard?.(text || '')
      try {
        localStorage.setItem(VOICE_LAST_TEXT_KEY, text || '')
        localStorage.setItem(VOICE_TRANSCRIPT_KEY, text || '')
      } catch {}
      if (!text) return
      append(text, 'user', 'голос')
      setIsProcessing(true)

      const parsed = parse(text, new Date())
      if (isReminderIntent(text) || parsed) {
        if (!parsed || !parsed.task) {
          const msg = 'Не разобрала дату или задачу. Попробуй еще раз.'
          setStatus?.(msg)
          append(msg, 'assistant', 'ошибка')
          setIsProcessing(false)
          return
        }
        try {
          const saved = await createReminder(parsed.task, parsed.due.getTime())
          await onReminderCreated?.()
          setLastCreated({
            id: saved?.id || uid(),
            task: parsed.task,
            due: parsed.due.toISOString(),
            transcript: text,
          })
          pulseTaskFlash()
          const ok = `Готово: ${parsed.task}, ${formatDueSpoken(parsed.due)}.`
          setStatus?.(ok)
          append(ok, 'assistant', 'успех')
        } catch (error) {
          const msg = error?.status === 409 ? 'Похожая задача уже существует. Новую запись не создала.' : 'Не удалось сохранить задачу.'
          setStatus?.(msg)
          append(msg, 'assistant', 'ошибка')
        }
      } else {
        try {
          const { reply } = await askAI(text)
          const out = reply || 'Нет ответа от ассистента.'
          setStatus?.(out)
          append(out, 'assistant', 'ответ')
        } catch {
          const msg = 'Ассистент недоступен.'
          setStatus?.(msg)
          append(msg, 'assistant', 'ошибка')
        }
      }
      setIsProcessing(false)
    },
    onStart: () => {
      setListening(true)
      const wakeEnabled = speech.getSettings().wake
      setStatus?.(wakeEnabled ? 'Микрофон включен. Жду хот-слово.' : 'Микрофон включен. Слушаю команду.')
    },
    onStop: () => {
      setListening(false)
      setVoiceLevel(0)
      setStatus?.('Микрофон выключен.')
      setInterim('')
    },
    onWake: () => {
      setWoke(true)
      setStatus?.('Ключевое слово услышано. Начинаю запись команды.')
      window.setTimeout(() => setWoke(false), 420)
    },
    onLevel: (lvl) => setVoiceLevel(lvl),
    onStateChange: (nextState) => {
      setSpeechState(nextState)
      if (nextState === SPEECH_STATE.ARMED) {
        setStatus?.('Слышу микрофон. Жду хот-слово.')
      } else if (nextState === SPEECH_STATE.CAPTURE && !isProcessing) {
        setStatus?.('Говорите задачу. Текст появится ниже сразу.')
      }
    },
  })

  const browserStatus = speechSupported ? 'Поддерживается в этом браузере' : 'Не поддерживается в этом браузере'
  const modeLabel =
    speechState === SPEECH_STATE.CAPTURE
      ? 'Запись команды'
      : speechState === SPEECH_STATE.ARMED
        ? 'Ожидание хот-слова'
        : 'Ожидание запуска'

  return (
    <div className={`voice-mobile ${taskFlash ? 'task-created' : ''}`}>
      <div className="voice-success-flash" aria-hidden="true" />
      <section className="voice-status-card">
        <div className={`live-chip ${listening ? 'on' : 'off'}`}>{listening ? 'МИКРОФОН ВКЛЮЧЕН' : 'МИКРОФОН ВЫКЛЮЧЕН'}</div>
        <div className="voice-status-main">{status}</div>
        <div className="voice-meta">{browserStatus} • Скин: <b>{skin}</b> • Режим: <b>{modeLabel}</b></div>
        <div className="voice-live-row">
          <div className={`voice-phase ${speechState}`}>{modeLabel}</div>
          <div className={`voice-hotword-indicator ${woke ? 'active' : ''}`}>{woke ? 'Хот-слово поймано' : 'Хот-слово не поймано'}</div>
        </div>
      </section>

      <section className="voice-history-card" ref={chatRef}>
        {messages.map((m) => (
          <article key={m.id} className={`chat-item ${m.type}`}>
            <p>{m.text}</p>
          </article>
        ))}
        {interim && <article className="chat-item user interim"><p>{interim}</p></article>}
        {isProcessing && <article className="chat-item assistant"><p>Обрабатываю...</p></article>}
      </section>

      <section className="voice-transcript-card">
        <div className="voice-transcript-head">
          <strong>Текст, который слышу</strong>
          <span>{interim ? 'Обновляется в реальном времени' : transcriptText ? 'Последняя распознанная фраза' : 'Жду речь'}</span>
        </div>
        <div className={`voice-transcript-body ${interim || transcriptText ? 'active' : ''}`}>
          {interim || transcriptText || 'После начала речи здесь сразу появится распознанный текст.'}
        </div>
      </section>

      {lastCreated ? (
        <section className="voice-created-card">
          <div className="created-badge">Задача сохранена</div>
          <strong>{lastCreated.task}</strong>
          <span>{formatDueSpoken(new Date(lastCreated.due))}</span>
          <p>Фраза: {lastCreated.transcript}</p>
        </section>
      ) : null}

      <section className="voice-dock">
        <MicButton
          listening={listening}
          woke={woke}
          mode={speechState}
          voiceLevel={voiceLevel}
          onClick={async () => {
            if (listening) {
              speech.stop()
              return
            }
            if (window.__poliPrimeAudio) window.__poliPrimeAudio()
            const ok = await speech.start()
            if (!ok) {
              setStatus?.('Не удалось запустить микрофон. Проверь разрешения и поддержку браузера.')
            }
          }}
          onHold={async () => {
            if (!listening) {
              const ok = await speech.start()
              if (!ok) return
            }
            speech.forceCapture?.()
          }}
        />
        <button
          type="button"
          className="ghost-action"
          onClick={() => {
            setMessages([])
            setLastCreated(null)
            setInterim('')
            setTranscriptText('')
            localStorage.removeItem(VOICE_MESSAGES_KEY)
            localStorage.removeItem(VOICE_LAST_TEXT_KEY)
            localStorage.removeItem(VOICE_TRANSCRIPT_KEY)
          }}
        >
          Очистить
        </button>
      </section>
    </div>
  )
}
