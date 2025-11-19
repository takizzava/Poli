// client/api/ai.js — calls our server-side YandexGPT proxy
export async function askAI(text) {
const USE_AI = false // пока
if (!isReminder(text)) {
  if (!USE_AI) {
    addMessage('ИИ сейчас отключен.', 'assistant')
    setStatus?.('🤷‍♂️ ИИ выключен')
    setIsProcessing(false)
    return
  }
  }
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    credentials: 'include'
  })
  if (!r.ok) throw new Error('ai failed')
  return await r.json()
}
