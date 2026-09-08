/**
 * Main process entry point.
 *
 * Sendrite is a tray-resident utility: there is no primary window, the app
 * stays alive with every window closed, and the only always-present UI is the
 * tray icon.
 */
import { app, BrowserWindow, Notification, dialog } from 'electron'
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

  // First run opens the welcome flow. Returning launches show nothing by
  // design (this is a tray app) -- which reads as "nothing happened" to a
  // user who just double-clicked a shortcut. A launch is the one moment we
  // know they're watching, so it's the right time to point at the tray icon
  // -- Windows hides new tray icons in the overflow area by default, and
  // that's the actual, most common reason people can't find the app.
  if (!settings.onboarded) {
    showSettingsWindow()
  } else if (Notification.isSupported()) {
    new Notification({
      title: 'Sendrite is running',
      body: 'Look for the icon in your system tray (click the ^ arrow if you don’t see it) to open Settings.'
    }).show()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) showSettingsWindow()
  })
}

// A tray app outlives its windows.
app.on('window-all-closed', () => {
  // Intentionally empty: do not quit.
})

app.on('will-quit', () => unregisterAll())
