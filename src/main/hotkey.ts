/**
 * Global hotkey registration.
 *
 * `globalShortcut.register` returns false when another app already owns the
 * combo, which is common and must be surfaced rather than swallowed -- a
 * silently dead hotkey is the worst possible failure for this app.
 */
import { globalShortcut } from 'electron'

let registered: string | null = null

export function registerHotkey(accelerator: string, handler: () => void): boolean {
  unregisterHotkey()

  try {
    const ok = globalShortcut.register(accelerator, handler)
    if (ok) {
      registered = accelerator
      return true
    }
    console.error(`[hotkey] ${accelerator} is already taken by another application`)
    return false
  } catch (err) {
    console.error(`[hotkey] ${accelerator} is not a valid accelerator:`, err)
    return false
  }
}

export function unregisterHotkey(): void {
  if (registered) {
    globalShortcut.unregister(registered)
    registered = null
  }
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  registered = null
  escapeBound = false
}

/**
 * Escape is only grabbed while the floating button is on screen, then handed
 * straight back. Holding it permanently would break Escape in every other app.
 */
let escapeBound = false

export function bindEscape(handler: () => void): void {
  if (escapeBound) return
  escapeBound = globalShortcut.register('Escape', handler)
}

export function unbindEscape(): void {
  if (!escapeBound) return
  globalShortcut.unregister('Escape')
  escapeBound = false
}

export function isRegistered(accelerator: string): boolean {
  return globalShortcut.isRegistered(accelerator)
}
