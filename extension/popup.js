// popup.js — UI logic, talks to background which proxies API requests
const $ = id => document.getElementById(id)

async function api(path, opts = {}){
  return new Promise((res) => {
    chrome.runtime.sendMessage({ type: 'api', path, ...opts }, (resp) => res(resp))
  })
}

// SpeechRecognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null
let recognition = null
let recognizing = false

function initSpeech(){
  if (!SpeechRecognition) return false
  try {
    recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript || ''
      const cur = $('remText').value || ''
      $('remText').value = (cur ? cur + ' ' : '') + text
    }
    recognition.onend = () => {
      recognizing = false
      const b = $('btnMic')
      if (b) b.classList.remove('active')
    }
    recognition.onerror = (e) => {
      recognizing = false
      const b = $('btnMic')
      if (b) b.classList.remove('active')
      console.error('speech error', e)
    }
    return true
  } catch (e) {
    console.error('speech init failed', e)
    return false
  }
}

function startSpeech(){
  if (!recognition) return
  try {
    recognition.start()
    recognizing = true
    const b = $('btnMic')
    if (b) b.classList.add('active')
  } catch (e) {
    console.error('startSpeech', e)
  }
}

function stopSpeech(){
  if (!recognition) return
  try { recognition.stop() } catch (e) {}
  recognizing = false
  const b = $('btnMic')
  if (b) b.classList.remove('active')
}

async function getServer(){
  return new Promise(r => chrome.storage.local.get({ serverUrl: 'http://localhost:8080' }, s => r(s.serverUrl)))
}

async function saveServer(url){
  return new Promise(r => chrome.storage.local.set({ serverUrl: url }, () => r()))
}

async function init(){
  const url = await getServer()
  $('serverUrl').value = url

  $('saveServer').addEventListener('click', async ()=>{
    await saveServer($('serverUrl').value.trim())
    alert('Сохранено')
  })

  $('loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault()
    const email = $('email').value.trim()
    const password = $('password').value
    const resp = await api('/api/login', { method: 'POST', body: { email, password } })
    if (resp?.ok) {
      $('email').value = ''
      $('password').value = ''
      await refreshUser()
    } else {
      alert('Ошибка: ' + (resp?.data?.error || resp?.error || resp?.status))
    }
  })

  $('btnLogout').addEventListener('click', async ()=>{
    await api('/api/logout', { method: 'POST' })
    await refreshUser()
  })

  $('btnFetch').addEventListener('click', refreshReminders)
  $('btnAddSample').addEventListener('click', addSampleReminder)

  // init speech recognition and mic button
  const speechAvailable = initSpeech()
  const micBtn = $('btnMic')
  if (micBtn) {
    if (!speechAvailable) micBtn.setAttribute('disabled', 'true')
    micBtn.addEventListener('click', () => {
      if (!speechAvailable) return alert('Распознавание речи не поддерживается в этом браузере')
      if (recognizing) stopSpeech()
      else startSpeech()
    })
  }

  // form handlers
  $('remForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    await saveReminder()
  })
  $('btnCancelEdit').addEventListener('click', cancelEdit)

  await refreshUser()
  await refreshReminders()
}

async function refreshUser(){
  const resp = await api('/api/me', { method: 'GET' })
  if (resp?.ok) {
    $('userBox').classList.remove('hidden')
    $('loginForm').classList.add('hidden')
    $('userInfo').textContent = resp.data.email + ' (id:' + resp.data.id + ')'
  } else {
    $('userBox').classList.add('hidden')
    $('loginForm').classList.remove('hidden')
    $('userInfo').textContent = ''
  }
}

async function refreshReminders(){
  const resp = await api('/api/reminders', { method: 'GET' })
  const list = $('remList')
  list.innerHTML = ''
  if (resp?.ok && Array.isArray(resp.data)){
    resp.data.forEach(r => {
      const li = document.createElement('li')
      const left = document.createElement('div')
      left.style.display = 'flex'
      const meta = document.createElement('span')
      meta.className = 'meta'
      meta.textContent = r.due ? new Date(r.due).toLocaleString() + ' — ' : ''
      const txt = document.createElement('span')
      txt.textContent = r.text || JSON.stringify(r)
      left.appendChild(meta)
      left.appendChild(txt)

      const actions = document.createElement('div')
      actions.className = 'rem-actions'
      const btnEdit = document.createElement('button')
      btnEdit.textContent = 'Изменить'
      btnEdit.addEventListener('click', () => beginEdit(r))
      const btnDel = document.createElement('button')
      btnDel.textContent = 'Удалить'
      btnDel.addEventListener('click', () => deleteReminder(r.id))
      actions.appendChild(btnEdit)
      actions.appendChild(btnDel)

      li.appendChild(left)
      li.appendChild(actions)
      list.appendChild(li)
    })
  } else if (resp?.status === 401) {
    const li = document.createElement('li')
    li.textContent = 'Не авторизован'
    list.appendChild(li)
  } else {
    const li = document.createElement('li')
    li.textContent = 'Ошибка загрузки'
    list.appendChild(li)
  }
}

async function addSampleReminder(){
  const now = new Date()
  const due = new Date(now.getTime() + 60*60*1000).toISOString()
  const resp = await api('/api/reminders', { method: 'POST', body: { text: 'Тестовое напоминание из расширения', due } })
  if (resp?.ok) await refreshReminders()
  else alert('Ошибка: ' + (resp?.data?.error || resp?.error || resp?.status))
}

let editingId = null

function toInputDatetime(ms){
  if (!ms) return ''
  const d = new Date(Number(ms))
  const tzOffset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - tzOffset * 60000)
  return local.toISOString().slice(0,16)
}

function fromInputDatetime(val){
  if (!val) return null
  const ms = Date.parse(val)
  return Number.isFinite(ms) ? ms : null
}

async function saveReminder(){
  const text = $('remText').value.trim()
  const dueVal = $('remDue').value
  const dueMs = fromInputDatetime(dueVal)
  if (!text || !dueMs) return alert('Введите текст и дату/время')

  if (editingId) {
    const resp = await api(`/api/reminders/${editingId}`, { method: 'PUT', body: { text, due: dueMs } })
    if (resp?.ok) {
      cancelEdit()
      await refreshReminders()
    } else {
      alert('Ошибка: ' + (resp?.data?.error || resp?.error || resp?.status))
    }
  } else {
    const resp = await api('/api/reminders', { method: 'POST', body: { text, due: dueMs } })
    if (resp?.ok) {
      $('remText').value = ''
      $('remDue').value = ''
      await refreshReminders()
    } else {
      alert('Ошибка: ' + (resp?.data?.error || resp?.error || resp?.status))
    }
  }
}

function beginEdit(r){
  editingId = r.id
  $('remText').value = r.text || ''
  $('remDue').value = toInputDatetime(r.due)
  $('btnSaveRem').textContent = 'Сохранить'
  $('btnCancelEdit').classList.remove('hidden')
}

function cancelEdit(){
  editingId = null
  $('remText').value = ''
  $('remDue').value = ''
  $('btnSaveRem').textContent = 'Добавить'
  $('btnCancelEdit').classList.add('hidden')
}

async function deleteReminder(id){
  if (!confirm('Удалить напоминание?')) return
  const resp = await api(`/api/reminders/${id}`, { method: 'DELETE' })
  if (resp?.ok) await refreshReminders()
  else alert('Ошибка удаления')
}

document.addEventListener('DOMContentLoaded', init)
