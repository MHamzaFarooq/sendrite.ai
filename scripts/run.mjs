/**
 * Launcher for electron-vite.
 *
 * VS Code's integrated terminal and extension host export
 * ELECTRON_RUN_AS_NODE=1. Electron honours that variable and boots as a plain
 * Node process, so `require('electron')` returns the path to the binary
 * instead of the API object and the app dies with:
 *
 *   TypeError: Cannot read properties of undefined (reading 'isPackaged')
 *
 * Stripping it here means `npm run dev` behaves the same in VS Code, Windows
 * Terminal and a Mac shell.
 *
 *   node scripts/run.mjs dev
 *   node scripts/run.mjs preview
 */
import { spawn } from 'node:child_process'

const env = { ...process.env }
for (const key of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE']) {
  delete env[key]
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('usage: node scripts/run.mjs <dev|preview|build>')
  process.exit(1)
}

const child = spawn('electron-vite', args, {
  env,
  stdio: 'inherit',
  shell: true
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
