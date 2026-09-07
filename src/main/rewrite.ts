/**
 * The flow. If you read one file in this project, read this one.
 *
 *   hotkey -> capture selection -> show button -> user picks a mode
 *          -> call Claude -> paste over the selection -> hide button
 *
 * Everything else in src/main is a detail in service of these two functions.
 */
import type { RewriteMode, Selection } from '@shared/types'
import { capture, replaceSelection } from './selection'
import { rewrite, RewriteError } from './ai'
import { loadSettings } from './store'
import { bindEscape, unbindEscape } from './hotkey'
import {
  hideButton,
  isButtonVisible,
  showButtonAt,
  updateButtonState
} from './windows/button'

/** The button self-dismisses so a stale session can never paste somewhere new. */
const SESSION_TIMEOUT_MS = 10_000

/** Mode used for instant mode and for the speculative prefetch. */
const DEFAULT_MODE: RewriteMode = 'improve'

interface Session {
  id: number
  selection: Selection
  controller: AbortController
  timer: NodeJS.Timeout
  /** Speculative result, keyed by the mode it was requested for. */
  prefetch?: { mode: RewriteMode; promise: Promise<string> }
}

let session: Session | null = null
let nextId = 1

function endSession(): void {
  if (!session) return
  clearTimeout(session.timer)
  session.controller.abort()
  session = null
  unbindEscape()
  hideButton()
}

/** Short preview for the button label. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 42 ? `${flat.slice(0, 42)}…` : flat
}

/* ------------------------------------------------------------------ */
/* Step 1: the hotkey                                                  */
/* ------------------------------------------------------------------ */

export async function onHotkey(): Promise<void> {
  // Pressing the hotkey again while the button is up is a dismiss.
  if (isButtonVisible()) {
    endSession()
    return
  }

  const settings = await loadSettings()
  const selection = await capture()

  // No selection is the common case for an accidental press. Stay silent.
  if (!selection) return

  const id = nextId++
  const controller = new AbortController()
  session = {
    id,
    selection,
    controller,
    timer: setTimeout(() => {
      if (session?.id === id) endSession()
    }, SESSION_TIMEOUT_MS)
  }

  if (settings.instantMode) {
    await applyRewrite(DEFAULT_MODE)
    return
  }

  showButtonAt(selection.rect, { phase: 'ready', preview: preview(selection.text) })
  bindEscape(() => endSession())

  // Speculative prefetch: start the model call now, while the user is still
  // moving the mouse toward the button. By the time they click, the answer is
  // usually already back and the rewrite feels instant. The cost is paying
  // for rewrites the user abandons -- about $0.001 each on Haiku.
  if (settings.prefetch) {
    startPrefetch(id, DEFAULT_MODE)
  }
}

function startPrefetch(id: number, mode: RewriteMode): void {
  if (!session || session.id !== id) return
  const current = session

  const promise = (async () => {
    const settings = await loadSettings()
    return rewrite({
      text: current.selection.text,
      mode,
      model: settings.model,
      signal: current.controller.signal
    })
  })()

  // A rejected prefetch is not an error yet -- the user may never click.
  // Swallow it here and let applyRewrite surface it if they do.
  promise.catch(() => undefined)
  current.prefetch = { mode, promise }
}

/* ------------------------------------------------------------------ */
/* Step 2: the user picks a mode                                       */
/* ------------------------------------------------------------------ */

export async function applyRewrite(mode: RewriteMode): Promise<void> {
  if (!session) return
  const current = session
  const settings = await loadSettings()

  updateButtonState({ phase: 'working' })

  try {
    // Reuse the speculative call when the user picked the mode we guessed.
    const result =
      current.prefetch?.mode === mode
        ? await current.prefetch.promise
        : await rewrite({
            text: current.selection.text,
            mode,
            model: settings.model,
            signal: current.controller.signal
          })

    // Bail if the session was dismissed while we were waiting.
    if (session?.id !== current.id) return

    // Hide before pasting: the overlay must not be on screen when focus
    // returns to the target app, and the user should see the result land.
    clearTimeout(current.timer)
    session = null
    unbindEscape()
    hideButton()

    await replaceSelection(result)
  } catch (err) {
    if (session?.id !== current.id) return
    // A cancelled call is the user's own doing -- never show a toast for it.
    if (err instanceof RewriteError && err.kind === 'aborted') return

    const message =
      err instanceof RewriteError
        ? err.kind === 'no-key'
          ? 'Add your API key in Settings'
          : err.message
        : 'Something went wrong'

    updateButtonState({ phase: 'error', message })
    // Leave the error on screen briefly, then clean up.
    setTimeout(() => {
      if (session?.id === current.id) endSession()
    }, 2600)
  }
}

/* ------------------------------------------------------------------ */
/* Dismissal                                                           */
/* ------------------------------------------------------------------ */

export function dismiss(): void {
  endSession()
}
