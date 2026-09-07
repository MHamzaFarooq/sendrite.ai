const IS_MAC = navigator.userAgent.includes('Mac')

/** `CommandOrControl+Alt+Space` -> `Ctrl Alt Space` / `⌘ ⌥ Space` */
export function prettyHotkey(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl') return IS_MAC ? '⌘' : 'Ctrl'
      if (part === 'Alt') return IS_MAC ? '⌥' : 'Alt'
      if (part === 'Shift') return IS_MAC ? '⇧' : 'Shift'
      if (part === 'Control') return IS_MAC ? '⌃' : 'Ctrl'
      return part
    })
    .join(' ')
}

/**
 * Turn a keydown into an Electron accelerator.
 * Returns null while the user is still only holding modifiers.
 */
export function toAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return null

  const named: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc'
  }
  parts.push(named[key] ?? (key.length === 1 ? key.toUpperCase() : key))

  // A bare letter is not a safe global hotkey.
  if (parts.length < 2) return null
  return parts.join('+')
}

/**
 * Combos we refuse to bind. Ctrl+Space is the input-method switcher on both
 * platforms and autocomplete in most IDEs -- it looks tempting and breaks
 * everything.
 */
const BLOCKED = new Set(['CommandOrControl+Space', 'CommandOrControl+C', 'CommandOrControl+V'])

export function hotkeyWarning(accelerator: string): string | null {
  if (BLOCKED.has(accelerator)) {
    return 'This combo is reserved by the OS or your editor. Pick another.'
  }
  return null
}
