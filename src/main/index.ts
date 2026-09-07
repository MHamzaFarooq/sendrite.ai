/**
 * Main process entry point.
 *
 * Sendrite is a tray-resident utility: there is no primary window, the app
 * stays alive with every window closed, and the only always-present UI is the
 * tray icon.
 */
import { app, BrowserWindow, dialog } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { registerHotkey, unregisterAll } from './hotkey'
import { onHotkey } from './rewrite'
import { createButtonWindow } from './windows/button'
import { showSettingsWindow } from './windows/settings'
import { createTray } from './tray'
import { loadSettings } from './store'
import { isKeyboardAvailable } from './native/keyboard'

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

  // First run opens the welcome flow.
  if (!settings.onboarded) showSettingsWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) showSettingsWindow()
  })
}

// A tray app outlives its windows.
app.on('window-all-closed', () => {
  // Intentionally empty: do not quit.
})

app.on('will-quit', () => unregisterAll())
