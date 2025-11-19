// src/speech/useSpeech.js
// ====== Голос: FSM IDLE → ARMED (ждём «Поли») → CAPTURE ======

const STATE = { IDLE: 'idle', ARMED: 'armed', CAPTURE: 'capture' }

// кириллица: границы слова через «не-буква/цифра/_»
const HOTWORD_RE = new RegExp(
  '(^|[^\\p{L}\\p{N}_])' +
    '(п\\s*о\\s*л\\s*и|полли|поля|поль|поле)' +
    '(?=$|[^\\p{L}\\p{N}_])',
  'iu'
)
function hasHotword(t) { return HOTWORD_RE.test(t) }
function stripHotword(t) { return t.replace(HOTWORD_RE, (_m, left) => (left || ' ')).trim() }

// маркеры досрочного завершения
const END_RE = /(создай|добавь|сохрани)(\s+(задач[ауе]|напоминан(?:ие|ье|ия)?))?$|всё$|готово$|конец$/i

// тайминги
const SILENCE_AFTER_FINAL_MS = 1600
const MAX_CAPTURE_MS = 15000
const RESTART_COOLDOWN_MS = 600

// --- settings persisted ---
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)) }catch{} }
function load(k, d){ try{ const v = localStorage.getItem(k); return v==null? d : JSON.parse(v) }catch{ return d } }
function loadNum(k,d){ const n=load(k,d); return Number.isFinite(+n)? +n : d }
function loadBool(k,d){ const v=load(k,d); return typeof v==='boolean'? v : d }

let WAKE_ON  = loadBool('wakeEnable', true)
let WINDOW_MS= loadNum('wakeWindow', 6000)

// --- globals for SR ---
let SRCls, recognition
let srStarting=false, srRunning=false, wantRunning=false, aborting=false
let lastRestart=0
let state = STATE.ARMED

let audioCtx = (typeof window !== 'undefined' && window.__poliAudioCtx) || null

// буферы распознавания
const capture = { buf:'', interim:'', timer:null, startedAt:0 }
let lastFinalText = '' // анти-дубли

// ===== helpers =====
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
    // если зовём stop() вручную — не перезапускаем
    if (aborting || !wantRunning) return
    const now = Date.now()
    if (now - lastRestart < RESTART_COOLDOWN_MS) return
    lastRestart = now
    try { srStarting = true; r.start() } catch {}
  }
  r.onerror = (e) => {
    // игнорим "aborted/no-speech"; на прочих даём шанс onend перезапустить, если нужно
    if (e?.error && e.error !== 'aborted' && e.error !== 'no-speech') {
      // можно логировать при желании
    }
  }
  r.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i]
      const text = (res[0]?.transcript || '').trim()
      if (!text) continue

      if (res.isFinal) {
        handleFinal(text)
      } else {
        handleInterim(text)
      }
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
  if (state !== STATE.CAPTURE) return
  state = STATE.ARMED
  clearTimeout(capture.timer)
  const text = (capture.buf + ' ' + capture.interim).replace(/\s+/g,' ').trim()
  capture.buf=''; capture.interim=''
  lastFinalText = ''
  onInterimCb?.('')
  if (!text) return
  const out = (text.replace(END_RE,'').trim() || text)
  onResultCb?.(out)
}

// ===== FSM handlers =====
function wakeFrom(textAfter=''){
  if (state === STATE.CAPTURE) return
  try{ beep() }catch{}
  onWakeCb?.()
  state = STATE.CAPTURE
  capture.buf = textAfter ? textAfter : ''
  capture.interim = ''
  capture.startedAt = Date.now()
  lastFinalText = ''
  onInterimCb?.('')
  armSilenceTimer()
}

function handleInterim(raw){
  let text = raw.replace(/\s+/g,' ').trim()

  if (state === STATE.ARMED){
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
    } else {
      // прямой режим — отображаем промежуточный текст
      onInterimCb?.(text)
      return
    }
  }

  if (state === STATE.CAPTURE){
    if (hasHotword(text)) text = stripHotword(text)
    capture.interim = text
    onInterimCb?.((capture.buf + ' ' + capture.interim).trim())
    if (END_RE.test(text)){ finalize(); return }
    extendSilenceTimer()
    return
  }
}

function handleFinal(raw){
  let text = raw.replace(/\s+/g,' ').trim()
  if (!text) return

  // анти-дубли финалов (некоторые движки присылают повтор)
  if (text && text === lastFinalText) return
  lastFinalText = text

  if (state === STATE.ARMED){
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

  if (state === STATE.CAPTURE){
    if (hasHotword(text)) text = stripHotword(text)
    if (text){
      capture.buf = (capture.buf + ' ' + text).trim()
      capture.interim = ''
      onInterimCb?.(capture.buf)
    }
    if (END_RE.test(text)){ finalize(); return }
    extendSilenceTimer()
    return
  }
}

// ===== public API =====
let onResultCb=null, onInterimCb=null, onWakeCb=null

export function useSpeech({ onResult, onFinal, onInterim, onStart, onStop, onWake } = {}){
  // совместимость: если передали onFinal — используем его как onResult
  onResultCb  = onFinal || onResult || null
  onInterimCb = onInterim || null
  onWakeCb    = onWake || null

  function safeStart(){
    if (!setup()) return
    if (!srRunning && !srStarting){
      try { srStarting = true; recognition.start() } catch {}
    }
  }

  async function start(){
    await ensureMicAccess()
    wantRunning = true; aborting = false
    state = WAKE_ON ? STATE.ARMED : STATE.CAPTURE
    safeStart()
    onStart?.()
  }

  function stop(){
    wantRunning = false
    aborting = true
    srStarting = false
    try { recognition?.stop() } catch {}
    state = STATE.IDLE
    clearTimeout(capture.timer)
    capture.buf=''; capture.interim=''
    lastFinalText = ''
    onInterimCb?.('')
    onStop?.()
  }

  function forceCapture(){
    if (!wantRunning) start()
    try{ beep() }catch{}
    state = STATE.CAPTURE
    capture.buf=''; capture.interim=''
    lastFinalText = ''
    capture.startedAt = Date.now()
    onInterimCb?.('')
    armSilenceTimer()
  }

  // глобальный «праймер» звука
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

  // если вкладка скрыта — не пытаемся перезапускать SR
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
    getSettings: ()=>({ wake: WAKE_ON, windowMs: WINDOW_MS })
  }
}
