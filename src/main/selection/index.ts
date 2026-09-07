/**
 * Selection capture, behind a strategy interface.
 *
 * v1 ships the clipboard strategy only. v2 adds an accessibility strategy --
 * UI Automation on Windows, AXUIElement on macOS, both living in a sidecar
 * process -- which returns the selection's real bounding rectangle and leaves
 * the clipboard untouched. When that lands, `capture()` tries it first and
 * silently falls back to the clipboard for apps that expose no a11y tree.
 */
import type { Selection } from '@shared/types'
import { captureViaClipboard, pasteText } from './clipboard-strategy'

export type { Selection }

/**
 * Read whatever text is currently selected in the focused application.
 * Returns null when there is no selection.
 */
export async function capture(): Promise<Selection | null> {
  // v2 hook:
  //   const viaA11y = await captureViaAccessibility()
  //   if (viaA11y) return viaA11y
  return captureViaClipboard()
}

/** Overwrite the live selection in the focused application. */
export async function replaceSelection(text: string): Promise<void> {
  return pasteText(text)
}
