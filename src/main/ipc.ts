/**
 * Every ipcMain handler. The renderer can only reach the main process
 * through these, and only through the allowlist in the preload bridge.
 */
import { ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { ModelId, PermissionStatus, RewriteMode, Settings } from '@shared/types'
import {
  clearApiKey,
  hasApiKey,
  loadSettings,
  saveSettings,
  setApiKey
} from './store'
import { testApiKey } from './ai'
import { applyRewrite, dismiss } from './rewrite'
import { isAccessibilityTrusted } from './native/keyboard'
import { registerHotkey } from './hotkey'
import { onHotkey } from './rewrite'
import { resizeButton } from './windows/button'
import { closeSettingsWindow } from './windows/settings'

const MAC_A11Y_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.getSettings, async (): Promise<Settings> => loadSettings())

  ipcMain.handle(
    IPC.saveSettings,
    async (_e, patch: Partial<Settings>): Promise<Settings> => {
      const previous = await loadSettings()
      const next = await saveSettings(patch)

      // A changed hotkey has to be re-bound immediately or the setting is a lie.
      if (patch.hotkey && patch.hotkey !== previous.hotkey) {
        registerHotkey(next.hotkey, () => {
          void onHotkey()
        })
      }
      return next
    }
  )

  ipcMain.handle(IPC.getPermissions, async (): Promise<PermissionStatus> => {
    const platform =
      process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'other'
    return { accessibility: isAccessibilityTrusted(), platform }
  })

  ipcMain.handle(IPC.requestAccessibility, async (): Promise<void> => {
    // There is no programmatic grant -- the user has to flip the switch.
    if (process.platform === 'darwin') await shell.openExternal(MAC_A11Y_PANE)
  })

  ipcMain.handle(IPC.setApiKey, async (_e, key: string): Promise<void> => setApiKey(key))
  ipcMain.handle(IPC.hasApiKey, async (): Promise<boolean> => hasApiKey())
  ipcMain.handle(IPC.clearApiKey, async (): Promise<void> => clearApiKey())

  ipcMain.handle(
    IPC.testApiKey,
    async (_e, key: string, model: ModelId): Promise<{ ok: boolean; message: string }> => {
      try {
        await testApiKey(key, model)
        return { ok: true, message: 'Key valid' }
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Key rejected' }
      }
    }
  )

  ipcMain.handle(IPC.runRewrite, async (_e, mode: RewriteMode): Promise<void> => {
    await applyRewrite(mode)
  })

  ipcMain.handle(IPC.dismissButton, async (): Promise<void> => dismiss())

  ipcMain.handle(
    IPC.resizeButton,
    async (_e, width: number, height: number): Promise<void> => resizeButton(width, height)
  )

  ipcMain.handle(IPC.closeSettings, async (): Promise<void> => closeSettingsWindow())
}
