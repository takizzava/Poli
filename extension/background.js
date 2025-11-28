// background.js — performs API requests without browser Origin header
const DEFAULT_SERVER = 'http://localhost:8080'

async function getServer(){
  return new Promise((res) => {
    chrome.storage.local.get({ serverUrl: DEFAULT_SERVER }, items => res(items.serverUrl || DEFAULT_SERVER))
  })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'api') {
    (async ()=>{
      try {
        const server = await getServer()
        const url = new URL(msg.path, server).toString()
        const opts = {
          method: msg.method || 'GET',
          headers: Object.assign({ 'content-type': 'application/json' }, msg.headers || {}),
          credentials: 'include'
        }
        if (msg.body) opts.body = JSON.stringify(msg.body)

        const resp = await fetch(url, opts)
        const ct = resp.headers.get('content-type') || ''
        let data = null
        if (ct.includes('application/json')) data = await resp.json()
        else data = await resp.text()

        sendResponse({ ok: resp.ok, status: resp.status, data })
      } catch (e) {
        sendResponse({ ok: false, error: String(e) })
      }
    })()
    // indicate we'll call sendResponse asynchronously
    return true
  }
})
