/**
 * Main process entry point.
 *
 * Sendrite is tray-resident: the app stays alive with every window closed,
 * and the tray icon is the only always-present UI. The Settings window is
 * not persistent, but it does open on every launch (see main(), below) so
 * that clicking the shortcut behaves like a normal app.
 */
import { app, BrowserWindow, dialog } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { registerHotkey, unregisterAll } from './hotkey'
import { onHotkey } from './rewrite'
import { createButtonWindow } from './windows/button'
import { showSettingsWindow } from './windows/settings'
import { createTray } from './tray'
import { loadSettings } from './store'
import { isKeyboardAvailable } from './native/keyboard'

/**
 * A tray-only app has no window to show a crash in. Without this, a failure
 * on a user's machine is invisible to them and unreproducible for us.
 */
function logCrash(label: string, err: unknown): void {
  try {
    const line = `${new Date().toISOString()} [${label}] ${err instanceof Error ? err.stack : String(err)}\n`
    appendFileSync(join(app.getPath('userData'), 'error.log'), line)
  } catch {
    // The log write itself failing is not something we can do anything about.
  }
}
process.on('uncaughtException', (err) => logCrash('uncaughtException', err))
process.on('unhandledRejection', (err) => logCrash('unhandledRejection', err))

// Only one Sendrite may hold the global hotkey.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showSettingsWindow())
  void main()
}

async function main(): Promise<void> {
  await app.whenReady()

  electronApp.setAppUserModelId('ai.sendrite.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // macOS: tray-only, no dock icon.
  if (process.platform === 'darwin') app.dock?.hide()

  registerIpcHandlers()

  // Build the overlay now, while the user is not waiting on it. Creating this
  // window on demand would add 200-500ms to every hotkey press.
  createButtonWindow()

  await createTray()

  const settings = await loadSettings()
  const bound = registerHotkey(settings.hotkey, () => {
    void onHotkey()
  })

  if (!bound) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Hotkey unavailable',
      message: `${settings.hotkey} is already in use by another application.`,
      detail: 'Pick a different shortcut in Settings.'
    })
    showSettingsWindow()
  }

  if (!isKeyboardAvailable()) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Native keyboard access failed',
      message: 'Sendrite could not load the OS keyboard bridge.',
      detail: `Platform: ${process.platform}. Rewrites will not be able to paste.`
    })
  }

  // Open on every launch, first run or not -- clicking the shortcut should
  // behave like any other app. (Re-launching while already running takes
  // the 'second-instance' path above, which does the same thing.)
  showSettingsWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) showSettingsWindow()
  })
}

// A tray app outlives its windows.
app.on('window-all-closed', () => {
  // Intentionally empty: do not quit.
})

app.on('will-quit', () => unregisterAll())
