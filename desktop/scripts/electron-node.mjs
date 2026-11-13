// Ejecuta un script de Node usando el binario de Electron (ELECTRON_RUN_AS_NODE=1),
// porque better-sqlite3 está compilado para la ABI de Electron, no para la de Node.
// Uso: node scripts/electron-node.mjs vitest run   |   node scripts/electron-node.mjs out/main/seed.js
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron')
const [first, ...rest] = process.argv.slice(2)
const entry =
  first === 'vitest' ? join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs') : first

const child = spawn(electron, [entry, ...rest], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
child.on('exit', (code) => process.exit(code ?? 1))
