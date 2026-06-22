// src/speech/useSpeech.js
export const SPEECH_STATE = { IDLE: 'idle', ARMED: 'armed', CAPTURE: 'capture' }

const END_RE = /(создай|добавь|сохрани)(\s+(задач[ауе]|напоминан(?:ие|ье|ия)?))?$|всё$|готово$|конец$/i

const SILENCE_AFTER_FINAL_MS = 1600
const MAX_CAPTURE_MS = 15000
const RESTART_COOLDOWN_MS = 600

function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)) }catch{} }
function load(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) }catch{ return d } }
function loadNum(k,d){ const n = load(k,d); return Number.isFinite(+n) ? +n : d }
function loadBool(k,d){ const v = load(k,d); return typeof v === 'boolean' ? v : d }

let WAKE_ON = loadBool('wakeEnable', true)
let WINDOW_MS = loadNum('wakeWindow', 6000)
let WAKE_WORDS = load('wakeWords', ['поли'])
if (!Array.isArray(WAKE_WORDS) || !WAKE_WORDS.length) WAKE_WORDS = ['поли']

let SRCls, recognition
let srStarting=false, srRunning=false, wantRunning=false, aborting=false
let lastRestart=0
let state = SPEECH_STATE.ARMED
let MANUAL_CAPTURE = false

let audioCtx = (typeof window !== 'undefined' && window.__poliAudioCtx) || null
const capture = { buf:'', interim:'', timer:null, startedAt:0 }
let lastFinalText = ''

function escapeRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function normalizeWord(s){ return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ') }

export function compileWakeRegex(words){
  const prepared = (Array.isArray(words) ? words : ['поли'])
    .map(normalizeWord)
    .filter(Boolean)
    .map((w) => escapeRegex(w).replace(/\s+/g, '\\s*'))
  const source = prepared.length ? prepared.join('|') : 'п\\s*о\\s*л\\s*и'
  return new RegExp(`(^|[^\\p{L}\\p{N}_])(${source})(?=$|[^\\p{L}\\p{N}_])`, 'iu')
}

let HOTWORD_RE = compileWakeRegex(WAKE_WORDS)
export function hasHotword(t, re = HOTWORD_RE) { return re.test(t) }
export function stripHotword(t, re = HOTWORD_RE) { return t.replace(re, (_m, left) => (left || ' ')).trim() }
export function normalizeTranscript(text = '') {
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/[.,!?…]+$/u, '')
    .trim()
}

export function finalizeCapturedText(buffer = '', interim = '') {
  const text = normalizeTranscript(`${buffer} ${interim}`)
  if (!text) return ''
  return normalizeTranscript(text.replace(END_RE, '').trim() || text)
}

function setState(nextState, meta = {}) {
  state = nextState
  onStateChangeCb?.(nextState, meta)
}

function beep(){
  try{
    if (!audioCtx || audioCtx.state !== 'running') return
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type='sine'; o.frequency.value=880
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime+0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.18)
    o.connect(g); g.connect(audioCtx.destination)
    o.start(); o.stop(audioCtx.currentTime+0.19)
  }catch{}
}

async function ensureMicAccess(){
  try{
    if (!navigator.mediaDevices?.getUserMedia) return true
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true })
    stream.getTracks().forEach(t=>t.stop())
    return true
  }catch{ return false }
}

function setup(){
  SRCls = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SRCls) return false
  if (recognition) return true

  const r = recognition = new SRCls()
  r.lang = 'ru-RU'
  r.interimResults = true
  r.continuous = true
  r.maxAlternatives = 3

  r.onstart = () => { srRunning = true; srStarting = false; aborting = false }
  r.onend = () => {
    srRunning = false; srStarting = false
    if (aborting || !wantRunning) return
    const now = Date.now()
    if (now - lastRestart < RESTART_COOLDOWN_MS) return
    lastRestart = now
    try { srStarting = true; r.start() } catch {}
  }
  r.onerror = () => {}
  r.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i]
      const text = (res[0]?.transcript || '').trim()
      if (!text) continue
      if (res.isFinal) handleFinal(text)
      else handleInterim(text)
    }
  }
  return true
}

function armSilenceTimer(){
  clearTimeout(capture.timer)
  const guard = Math.min(WINDOW_MS, MAX_CAPTURE_MS)
  const initial = Math.min(guard, SILENCE_AFTER_FINAL_MS)
  capture.timer = setTimeout(finalize, initial)
}
function extendSilenceTimer(){
  clearTimeout(capture.timer)
  const elapsed = Date.now() - capture.startedAt
  const leftByWindow = Math.max(0, WINDOW_MS - elapsed)
  const leftByMax = Math.max(0, MAX_CAPTURE_MS - elapsed)
  const next = Math.min(SILENCE_AFTER_FINAL_MS, leftByWindow, leftByMax)
  if (next > 0) capture.timer = setTimeout(finalize, next)
  else finalize()
}

function finalize(){
  if (state !== SPEECH_STATE.CAPTURE) return
  clearTimeout(capture.timer)
  const text = finalizeCapturedText(capture.buf, capture.interim)
  capture.buf=''; capture.interim=''; capture.startedAt = 0
  lastFinalText = ''
  onInterimCb?.('')
  onLevelCb?.(0)
  setState(MANUAL_CAPTURE ? SPEECH_STATE.CAPTURE : SPEECH_STATE.ARMED, { reason: 'finalize' })
  if (!text) return
  onResultCb?.(text)
}

function wakeFrom(textAfter=''){
  if (state === SPEECH_STATE.CAPTURE) return
  try{ beep() }catch{}
  onWakeCb?.()
  MANUAL_CAPTURE = false
  setState(SPEECH_STATE.CAPTURE, { reason: 'wake' })
  capture.buf = textAfter ? textAfter : ''
  capture.interim = ''
  capture.startedAt = Date.now()
  lastFinalText = ''
  onInterimCb?.('')
  armSilenceTimer()
}

function handleInterim(raw){
  let text = normalizeTranscript(raw)
  const lvl = Math.min(1, Math.max(0, text.length / 24))
  onLevelCb?.(lvl)

  if (state === SPEECH_STATE.ARMED){
    if (WAKE_ON){
      if (hasHotword(text)){
        const rest = stripHotword(text)
        wakeFrom(rest)
        if (rest){
          capture.buf = (capture.buf + ' ' + rest).trim()
          onInterimCb?.(capture.buf)
        }
      }
      return
    }
    onInterimCb?.(text)
    return
  }

  if (state === SPEECH_STATE.CAPTURE){
    if (!capture.startedAt) capture.startedAt = Date.now()
    if (hasHotword(text)) text = stripHotword(text)
    capture.interim = text
    onInterimCb?.((capture.buf + ' ' + capture.interim).trim())
    if (END_RE.test(text)){ finalize(); return }
    extendSilenceTimer()
  }
}

function handleFinal(raw){
  let text = normalizeTranscript(raw)
  if (!text) return
  if (text === lastFinalText) return
  lastFinalText = text

  if (state === SPEECH_STATE.ARMED){
    if (WAKE_ON && hasHotword(text)){
      const rest = stripHotword(text)
      wakeFrom(rest)
      if (rest){
        capture.buf = (capture.buf + ' ' + rest).trim()
        onInterimCb?.(capture.buf)
      }
    } else if (!WAKE_ON){
      onResultCb?.(text)
    }
    return
  }

  if (state === SPEECH_STATE.CAPTURE){
    if (hasHotword(text)) text = stripHotword(text)
    if (text){
      capture.buf = (capture.buf + ' ' + text).trim()
      capture.interim = ''
      onInterimCb?.(capture.buf)
    }
    if (END_RE.test(text)){ finalize(); return }
    extendSilenceTimer()
  }
}

let onResultCb=null, onInterimCb=null, onWakeCb=null, onLevelCb=null, onStateChangeCb=null

if (typeof window !== 'undefined' && !window.__poliWakeWordsBind) {
  window.__poliWakeWordsBind = true
  window.addEventListener('wake-words-changed', (event) => {
    const words = Array.isArray(event?.detail) ? event.detail : []
    WAKE_WORDS = words.length ? words : ['поли']
    HOTWORD_RE = compileWakeRegex(WAKE_WORDS)
  })
}

export function useSpeech({ onResult, onFinal, onInterim, onStart, onStop, onWake, onLevel, onStateChange } = {}){
  onResultCb  = onFinal || onResult || null
  onInterimCb = onInterim || null
  onWakeCb    = onWake || null
  onLevelCb   = onLevel || null
  onStateChangeCb = onStateChange || null

  function safeStart(){
    if (!setup()) return false
    if (!srRunning && !srStarting){
      try { srStarting = true; recognition.start() } catch {}
    }
    return true
  }

  async function start(){
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!supported) return false
    const micOk = await ensureMicAccess()
    if (!micOk) return false
    wantRunning = true; aborting = false
    MANUAL_CAPTURE = false
    capture.buf=''; capture.interim=''; capture.startedAt=0
    lastFinalText = ''
    setState(WAKE_ON ? SPEECH_STATE.ARMED : SPEECH_STATE.CAPTURE, { reason: 'start' })
    if (!WAKE_ON) {
      capture.startedAt = Date.now()
      armSilenceTimer()
    }
    const started = safeStart()
    if (!started) return false
    onStart?.()
    return true
  }

  function stop(){
    wantRunning = false
    MANUAL_CAPTURE = false
    aborting = true
    srStarting = false
    try { recognition?.stop() } catch {}
    setState(SPEECH_STATE.IDLE, { reason: 'stop' })
    clearTimeout(capture.timer)
    capture.buf=''; capture.interim=''
    lastFinalText = ''
    onInterimCb?.('')
    onLevelCb?.(0)
    onStop?.()
  }

  function forceCapture(){
    if (!wantRunning) start()
    try{ beep() }catch{}
    MANUAL_CAPTURE = true
    setState(SPEECH_STATE.CAPTURE, { reason: 'manual' })
    capture.buf=''; capture.interim=''
    lastFinalText = ''
    capture.startedAt = Date.now()
    onInterimCb?.('')
    armSilenceTimer()
  }

  if (typeof window!=='undefined' && !window.__poliPrimeAudio){
    window.__poliPrimeAudio = function(){
      try{
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return false
        if (!audioCtx){ audioCtx = new Ctx(); window.__poliAudioCtx = audioCtx }
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{})
        return true
      }catch{ return false }
    }
  }

  if (typeof document !== 'undefined' && !window.__poliVisBind){
    window.__poliVisBind = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return
      if (wantRunning && !srRunning) safeStart()
    })
  }

  return {
    start, stop, forceCapture,
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    setWakeEnabled: (v)=>{ WAKE_ON = !!v; save('wakeEnable', WAKE_ON) },
    setWindowMs: (ms)=>{ WINDOW_MS = +ms || 6000; save('wakeWindow', WINDOW_MS) },
    setWakeWords: (words)=>{
      WAKE_WORDS = Array.isArray(words) && words.length ? words : ['поли']
      save('wakeWords', WAKE_WORDS)
      HOTWORD_RE = compileWakeRegex(WAKE_WORDS)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wake-words-changed', { detail: WAKE_WORDS }))
      }
    },
    getSettings: ()=>({ wake: WAKE_ON, windowMs: WINDOW_MS, wakeWords: WAKE_WORDS, state })
  }
}
