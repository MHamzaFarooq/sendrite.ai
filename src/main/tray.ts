import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { loadSettings, saveSettings } from './store'
import { showSettingsWindow } from './windows/settings'

let tray: Tray | null = null

function iconPath(): string {
  // macOS uses a template image so the icon adapts to light/dark menu bars.
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'
  return join(__dirname, '../../resources', file)
}

export async function createTray(): Promise<Tray> {
  const image = nativeImage.createFromPath(iconPath())
  if (process.platform === 'darwin') image.setTemplateImage(true)

  tray = new Tray(image)
  tray.setToolTip('Sendrite — rewrite any text, in any app')
  await refreshTrayMenu()

  // Windows convention: clicking the tray icon opens the app.
  if (process.platform === 'win32') {
    tray.on('click', () => showSettingsWindow())
  }

  return tray
}

export async function refreshTrayMenu(): Promise<void> {
  if (!tray) return
  const settings = await loadSettings()

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Rewrite selection    ${prettyAccelerator(settings.hotkey)}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Instant mode (skip the button)',
        type: 'checkbox',
        checked: settings.instantMode,
        click: async (item) => {
          await saveSettings({ instantMode: item.checked })
          await refreshTrayMenu()
        }
      },
      { label: 'Settings…', click: () => showSettingsWindow() },
      { type: 'separator' },
      { label: 'Quit Sendrite', click: () => app.quit() }
    ])
  )
}

/** `CommandOrControl+Alt+Space` -> `Ctrl+Alt+Space` / `⌘⌥Space` */
function prettyAccelerator(accelerator: string): string {
  if (process.platform !== 'darwin') {
    return accelerator.replace('CommandOrControl', 'Ctrl').replace(/\+/g, '+')
  }
  return accelerator
    .replace('CommandOrControl', '⌘')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace('Control', '⌃')
    .replace(/\+/g, '')
}
