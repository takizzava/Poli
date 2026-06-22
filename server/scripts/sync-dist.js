import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const distPath = resolve(root, 'dist')
const targetPath = resolve(root, 'server', 'public')

if (!existsSync(distPath)) {
  throw new Error(`Build output not found: ${distPath}`)
}

rmSync(targetPath, { force: true, recursive: true })
mkdirSync(targetPath, { recursive: true })
cpSync(distPath, targetPath, { recursive: true })
