/**
 * Selection capture via clipboard round-trip.
 *
 * Works in essentially every app on both platforms, which is why it is the
 * v1 strategy and the permanent fallback. Two known costs:
 *
 *   1. It briefly takes over the clipboard. We snapshot and restore it, but
 *      only the text flavour survives -- an image or file list on the
 *      clipboard is lost. The accessibility strategy avoids this entirely.
 *   2. It cannot tell us *where* the selection is, only what it says, so the
 *      button is anchored to the mouse cursor instead of the text.
 */
import { clipboard, screen } from 'electron'
import type { Rect, Selection } from '@shared/types'
import { sendCopy, sendPaste } from '../native/keyboard'

/** Unique marker so we can tell "copy landed" from "clipboard unchanged". */
const SENTINEL = `__sendrite_${Date.now()}__`

const POLL_INTERVAL_MS = 12
const POLL_TIMEOUT_MS = 420

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** A small box at the mouse cursor, used as the button anchor. */
function cursorRect(): Rect {
  const point = screen.getCursorScreenPoint()
  return { x: point.x, y: point.y, width: 0, height: 0 }
}

/**
 * Copy the host app's current selection without permanently disturbing the
 * user's clipboard. Returns null when nothing was selected.
 */
export async function captureViaClipboard(): Promise<Selection | null> {
  const saved = clipboard.readText()

  try {
    // Write a sentinel first: if it is still there after the copy, the target
    // app had no selection (or ignored us) and we should not show a button.
    clipboard.writeText(SENTINEL)
    sendCopy()

    const deadline = Date.now() + POLL_TIMEOUT_MS
    let copied = ''
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS)
      const current = clipboard.readText()
      if (current && current !== SENTINEL) {
        copied = current
        break
      }
    }

    const text = copied.trim()
    if (!text) return null

    return { text: copied, rect: cursorRect(), source: 'clipboard' }
  } finally {
    // Always hand the clipboard back, even if the copy timed out.
    if (saved) clipboard.writeText(saved)
    else clipboard.clear()
  }
}

/**
 * Replace the host app's current selection with `text`.
 *
 * The selection is still live because our button window never took focus, so
 * a paste overwrites it. Restoring the clipboard has to wait until the target
 * app has actually consumed the paste, hence the delay.
 */
export async function pasteText(text: string): Promise<void> {
  const saved = clipboard.readText()

  clipboard.writeText(text)
  // Give the OS a beat to register the new clipboard contents before pasting.
  await sleep(30)
  sendPaste()

  // Too short and the target app pastes the *restored* clipboard instead.
  await sleep(220)
  if (saved) clipboard.writeText(saved)
}
