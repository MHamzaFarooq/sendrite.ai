/**
 * The floating rewrite button.
 *
 * Three things about this window are load-bearing:
 *
 *   focusable: false   If this window took keyboard focus, the source app
 *                      would deactivate and lose its selection -- and the
 *                      paste would land nowhere. On Windows Electron maps
 *                      this to WS_EX_NOACTIVATE. This is the single most
 *                      important line in the file.
 *
 *   created at boot    Creating a BrowserWindow on demand costs 200-500ms,
 *                      which is fatal for a hotkey interaction. We build it
 *                      once, keep it hidden offscreen, and only move + show.
 *
 *   type: 'panel'      macOS needs an NSPanel to float over other apps
 *                      without activating. Verify the non-activating style
 *                      mask on your target macOS version; `node-mac-panel`
 *                      is the fallback if Electron's panel type is not enough.
 */
import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { ButtonState, Rect } from '@shared/types'
import { IPC } from '@shared/ipc'

const COLLAPSED = { width: 188, height: 48 }
/** Gap between the selection (or cursor) and the button. */
const OFFSET = 10

let win: BrowserWindow | null = null
let lastAnchor: Rect | null = null

export function createButtonWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) return win

  win = new BrowserWindow({
    ...COLLAPSED,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    acceptFirstMouse: true,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 'screen-saver' is the highest level; keeps us above fullscreen apps.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Never let the overlay navigate or spawn windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/button.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/button.html'))
  }

  return win
}

/** Clamp a proposed window position into the work area of its display. */
function clamp(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const { workArea } = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) })
  return {
    x: Math.round(Math.min(Math.max(x, workArea.x + 4), workArea.x + workArea.width - width - 4)),
    y: Math.round(Math.min(Math.max(y, workArea.y + 4), workArea.y + workArea.height - height - 4))
  }
}

/**
 * Position relative to the selection.
 *
 * A zero-width rect means the clipboard strategy gave us the mouse cursor
 * rather than real selection bounds, so we behave like a context menu and
 * sit below-right of the pointer. With real bounds we sit just past the end
 * of the highlighted text, vertically centred on its last line.
 */
function anchorFor(rect: Rect, width: number, height: number): { x: number; y: number } {
  if (rect.width > 0 || rect.height > 0) {
    return clamp(rect.x + rect.width + OFFSET, rect.y + rect.height / 2 - height / 2, width, height)
  }
  return clamp(rect.x + OFFSET + 4, rect.y + OFFSET + 4, width, height)
}

export function showButtonAt(rect: Rect, state: ButtonState): void {
  const w = createButtonWindow()
  lastAnchor = rect

  w.setBounds({ ...anchorFor(rect, COLLAPSED.width, COLLAPSED.height), ...COLLAPSED })
  w.webContents.send(IPC.buttonState, state)

  // showInactive, not show -- show() would steal focus on some platforms and
  // undo the whole point of focusable: false.
  w.showInactive()
}

export function updateButtonState(state: ButtonState): void {
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send(IPC.buttonState, state)
  }
}

/** Called by the renderer when its content grows (mode menu opening). */
export function resizeButton(width: number, height: number): void {
  if (!win || win.isDestroyed() || !lastAnchor) return
  win.setBounds({ ...anchorFor(lastAnchor, width, height), width, height })
}

export function hideButton(): void {
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.hide()
    win.setBounds({ ...COLLAPSED, x: -2000, y: -2000 })
  }
}

export function isButtonVisible(): boolean {
  return Boolean(win && !win.isDestroyed() && win.isVisible())
}
