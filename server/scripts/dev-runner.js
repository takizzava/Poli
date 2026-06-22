import net from 'node:net'
import { spawn } from 'node:child_process'

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port)
  })
}

async function findFreePort(start = 18081, end = 19999) {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port
  }
  throw new Error(`No free port in range ${start}-${end}`)
}

const apiPort = await findFreePort()
const env = {
  ...process.env,
  PORT: String(apiPort),
  VITE_API_PROXY: `http://127.0.0.1:${apiPort}`,
}

console.log(`[dev-runner] api port: ${apiPort}`)

const server = spawn('npm', ['run', 'dev:server'], { stdio: 'inherit', env, shell: true })
const client = spawn('npm', ['run', 'dev:client'], { stdio: 'inherit', env, shell: true })

let exiting = false
function shutdown(code = 0) {
  if (exiting) return
  exiting = true
  server.kill('SIGTERM')
  client.kill('SIGTERM')
  process.exit(code)
}

server.on('exit', (code) => {
  if (!exiting) shutdown(code ?? 0)
})

client.on('exit', (code) => {
  if (!exiting) shutdown(code ?? 0)
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
