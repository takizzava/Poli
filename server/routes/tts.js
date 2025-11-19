import { Router } from 'express'
import fetch from 'node-fetch'

const r = Router()

r.post('/tts', async (req, res) => {
  try{
    const { text, voiceId } = req.body || {}
    const key = process.env.CAMB_API_KEY
    if (!key) return res.status(500).json({ error:'no_camb_key' })
    const vId = voiceId || process.env.CAMB_VOICE_ID || '1258'

    // CAMB.AI: simple TTS REST — endpoint naming may vary by account plan.
    // This call assumes JSON body with { voice_id, input, format:'mp3' } and returns binary audio.
    const resp = await fetch('https://api.camb.ai/tts', {
      method:'POST',
      headers:{
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ voice_id: vId, input: text || '', format:'mp3' })
    })

    if (!resp.ok){
      const txt = await resp.text().catch(()=> '')
      return res.status(resp.status).json({ error:'camb_error', detail: txt })
    }
    const buf = Buffer.from(await resp.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.send(buf)
  }catch(e){
    console.error('[tts]', e)
    res.status(500).json({ error:'tts_error' })
  }
})

export default r
