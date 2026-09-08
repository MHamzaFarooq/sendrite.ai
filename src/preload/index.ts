/**
 * The only channel between the renderers and the main process.
 *
 * contextIsolation is on and nodeIntegration is off, so the renderer sees
 * exactly the functions listed here and nothing else. Note what is absent:
 * there is no way for a renderer to read the API key back out.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  ButtonState,
  PermissionStatus,
  Provider,
  RewriteMode,
  Settings
} from '@shared/types'

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.saveSettings, patch),

  getPermissions: (): Promise<PermissionStatus> => ipcRenderer.invoke(IPC.getPermissions),
  requestAccessibility: (): Promise<void> => ipcRenderer.invoke(IPC.requestAccessibility),

  validateApiKey: (provider: Provider, key: string): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke(IPC.validateApiKey, provider, key),
  hasApiKey: (provider: Provider): Promise<boolean> => ipcRenderer.invoke(IPC.hasApiKey, provider),
  clearApiKey: (provider: Provider): Promise<void> => ipcRenderer.invoke(IPC.clearApiKey, provider),

  runRewrite: (mode: RewriteMode): Promise<void> => ipcRenderer.invoke(IPC.runRewrite, mode),
  dismissButton: (): Promise<void> => ipcRenderer.invoke(IPC.dismissButton),
  resizeButton: (width: number, height: number): Promise<void> =>
    ipcRenderer.invoke(IPC.resizeButton, width, height),
  closeSettings: (): Promise<void> => ipcRenderer.invoke(IPC.closeSettings),

  /** Returns an unsubscribe function. */
  onButtonState: (cb: (state: ButtonState) => void): (() => void) => {
    const listener = (_e: unknown, state: ButtonState): void => cb(state)
    ipcRenderer.on(IPC.buttonState, listener)
    return () => ipcRenderer.removeListener(IPC.buttonState, listener)
  }
}

export type SendriteApi = typeof api

contextBridge.exposeInMainWorld('sendrite', api)
