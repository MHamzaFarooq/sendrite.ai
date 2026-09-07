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
 * Selectable models.
 *
 * Default is Haiku 4.5: this interaction lives or dies on latency, and a
 * ~40-word rewrite does not need a frontier model. Sonnet 5 and Opus 5 are
 * exposed for users who want more quality per rewrite.
 */
export const MODELS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'] as const
export type ModelId = (typeof MODELS)[number]

export const MODEL_LABELS: Record<ModelId, string> = {
  'claude-haiku-4-5': 'Claude Haiku 4.5  ·  fastest',
  'claude-sonnet-5': 'Claude Sonnet 5  ·  balanced',
  'claude-opus-5': 'Claude Opus 5  ·  highest quality'
}

export interface Settings {
  hotkey: string
  model: ModelId
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
  model: 'claude-haiku-4-5',
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
