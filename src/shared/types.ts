/**
 * Types shared by the main process, the preload bridge and both renderers.
 * This file must stay dependency-free so every layer can import it.
 */

/** Rewrite styles offered on the floating button. */
export const REWRITE_MODES = ['improve', 'shorten', 'formal', 'casual', 'grammar'] as const
export type RewriteMode = (typeof REWRITE_MODES)[number]

export const MODE_LABELS: Record<RewriteMode, string> = {
  improve: 'Improve',
  shorten: 'Shorten',
  formal: 'Formal',
  casual: 'Casual',
  grammar: 'Fix grammar'
}

/**
 * Providers a user can bring their own key for.
 *
 * There is deliberately no hardcoded model list: model names change too
 * often to bake into the app. Instead, validating a key calls that
 * provider's own `models.list()` endpoint and picks a fast default from
 * whatever it actually returns -- see `main/ai/providers/`.
 */
export const PROVIDERS = ['anthropic', 'openai', 'google'] as const
export type Provider = (typeof PROVIDERS)[number]

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'OpenAI',
  google: 'Gemini (Google)'
}

export interface Settings {
  hotkey: string
  /** Which of the user's saved keys is active for rewrites. */
  provider: Provider
  /** Model chosen automatically when the active provider's key was validated. */
  model: string
  /** Fire the rewrite immediately on hotkey instead of waiting for a click. */
  instantMode: boolean
  /** Kick off the model call on hotkey so the answer is usually ready on click. */
  prefetch: boolean
  onboarded: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  // Ctrl+Space collides with IME switching and IDE autocomplete, so the
  // default is the safer three-key combo.
  hotkey: 'CommandOrControl+Alt+Space',
  provider: 'anthropic',
  model: '',
  instantMode: false,
  prefetch: true,
  onboarded: false
}

/** A rectangle in screen (not window) coordinates. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * What a selection strategy hands back.
 * `rect` is the selection's bounding box when the strategy can determine it,
 * otherwise a zero-size box at the cursor.
 */
export interface Selection {
  text: string
  rect: Rect
  /** Which strategy produced this, for diagnostics in the settings window. */
  source: 'accessibility' | 'clipboard'
}

/** Pushed from main to the button window. */
export type ButtonState =
  | { phase: 'idle' }
  | { phase: 'ready'; preview: string }
  | { phase: 'working' }
  | { phase: 'error'; message: string }

export interface PermissionStatus {
  /** macOS Accessibility permission. Always true on Windows. */
  accessibility: boolean
  platform: 'win32' | 'darwin' | 'other'
}
