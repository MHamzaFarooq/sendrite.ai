/**
 * Settings and secret storage.
 *
 * Settings go in plain JSON under userData. The API key does not: it is
 * encrypted with Electron's `safeStorage`, which is backed by DPAPI on
 * Windows and the Keychain on macOS. Same guarantee as keytar, but with no
 * native module to compile.
 */
import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'

let settingsPath = ''
let keyPath = ''
let cache: Settings | null = null

function paths(): { settings: string; key: string } {
  if (!settingsPath) {
    const dir = app.getPath('userData')
    settingsPath = join(dir, 'settings.json')
    keyPath = join(dir, 'credentials.bin')
  }
  return { settings: settingsPath, key: keyPath }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function loadSettings(): Promise<Settings> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(paths().settings, 'utf8')
    // Spread over defaults so a settings file written by an older build
    // still boots after we add a field.
    cache = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch }
  cache = next
  await fs.writeFile(paths().settings, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/* ------------------------------------------------------------------ */
/* API key                                                             */
/* ------------------------------------------------------------------ */

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim()
  if (!trimmed) return clearApiKey()

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable, refusing to store the key in plaintext.')
  }
  await fs.writeFile(paths().key, safeStorage.encryptString(trimmed))
}

export async function getApiKey(): Promise<string | null> {
  try {
    const blob = await fs.readFile(paths().key)
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(blob)
  } catch {
    return null
  }
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null
}

export async function clearApiKey(): Promise<void> {
  await fs.rm(paths().key, { force: true })
}

/** `sk-ant-…4f2a` for display, never the whole thing. */
export function maskKey(key: string): string {
  if (key.length < 12) return '••••'
  return `${key.slice(0, 7)}${'•'.repeat(16)}${key.slice(-4)}`
}
