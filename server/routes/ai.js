// server/routes/ai.js — YandexGPT integration
import { Router } from 'express'

const r = Router()

/**
 * POST /api/ai
 * body: { text: string }
 * response: { reply: string, usage?, modelVersion? }
 */
r.post('/ai', async (req, res) => {
  try {
    const { text } = req.body || {}
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text required' })
    }

    // ---- ENV ----
    const FOLDER_ID = process.env.YA_FOLDER_ID || process.env.YC_FOLDER_ID || process.env.YANDEX_FOLDER_ID || process.env.CATALOG_ID
    const API_KEY   = process.env.YA_API_KEY   || process.env.YANDEX_API_KEY || process.env.YC_API_KEY
    const IAM_TOKEN = process.env.YA_IAM_TOKEN || process.env.IAM_TOKEN
    const MODEL     = process.env.YA_MODEL     || 'yandexgpt-lite'
    const TEMP      = Number(process.env.YA_TEMPERATURE || 0.2)
    const MAXTOKENS = String(process.env.YA_MAX_TOKENS || 800)
    const SYSTEM    = (process.env.YA_SYSTEM_PROMPT || 'Ты дружелюбная русскоязычная помощница по имени Поли. Отвечай коротко и по делу.').slice(0, 2000)

    if (!FOLDER_ID) {
      return res.status(500).json({ error: 'YA_FOLDER_ID is not set' })
    }
    const modelUri = process.env.YA_MODEL_URI || `gpt://${FOLDER_ID}/${MODEL}/latest`

    const headers = { 'Content-Type': 'application/json' }
    if (API_KEY) headers['Authorization'] = `Api-Key ${API_KEY}`
    else if (IAM_TOKEN) headers['Authorization'] = `Bearer ${IAM_TOKEN}`
    else return res.status(500).json({ error: 'YA_API_KEY or YA_IAM_TOKEN required' })
    // Optional privacy header
    headers['x-data-logging-enabled'] = 'false'

    const body = {
      modelUri,
      completionOptions: {
        stream: false,
        temperature: Number.isFinite(TEMP) ? TEMP : 0.2,
        maxTokens: MAXTOKENS
      },
      messages: [
        { role: 'system', text: SYSTEM },
        { role: 'user', text }
      ]
    }

    const resp = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.error('[yagpt] HTTP', resp.status, json)
      return res.status(502).json({ error: 'ai_failed' })
    }

    const reply = (json?.alternatives?.[0]?.message?.text || '').trim()
    return res.json({ reply, usage: json?.usage, modelVersion: json?.modelVersion })
  } catch (e) {
    console.error('[ai route]', e)
    res.status(500).json({ error: 'ai_failed' })
  }
})

export default r
