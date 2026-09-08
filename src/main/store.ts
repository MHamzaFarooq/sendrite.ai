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
import { DEFAULT_SETTINGS, type Provider, type Settings } from '@shared/types'

let settingsPath = ''
let userDataDir = ''
let cache: Settings | null = null

function paths(): { settings: string; userData: string } {
  if (!settingsPath) {
    const dir = app.getPath('userData')
    settingsPath = join(dir, 'settings.json')
    userDataDir = dir
  }
  return { settings: settingsPath, userData: userDataDir }
}

/** One encrypted file per provider, so switching providers never loses the others' keys. */
function keyPath(provider: Provider): string {
  return join(paths().userData, `credentials-${provider}.bin`)
}

/**
 * Every build before multi-provider support stored one Anthropic key at
 * this path. Migrate it in place the first time it's needed so an existing
 * user's key does not just silently vanish.
 */
async function migrateLegacyAnthropicKey(): Promise<void> {
  const legacyPath = join(paths().userData, 'credentials.bin')
  const newPath = keyPath('anthropic')
  try {
    await fs.access(newPath)
    return // Already migrated.
  } catch {
    // Fall through -- no new-style file yet.
  }
  try {
    await fs.rename(legacyPath, newPath)
  } catch {
    // No legacy file either; nothing to migrate.
  }
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

export async function setApiKey(provider: Provider, key: string): Promise<void> {
  const trimmed = key.trim()
  if (!trimmed) return clearApiKey(provider)

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable, refusing to store the key in plaintext.')
  }
  await fs.writeFile(keyPath(provider), safeStorage.encryptString(trimmed))
}

export async function getApiKey(provider: Provider): Promise<string | null> {
  if (provider === 'anthropic') await migrateLegacyAnthropicKey()
  try {
    const blob = await fs.readFile(keyPath(provider))
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(blob)
  } catch {
    return null
  }
}

export async function hasApiKey(provider: Provider): Promise<boolean> {
  return (await getApiKey(provider)) !== null
}

export async function clearApiKey(provider: Provider): Promise<void> {
  await fs.rm(keyPath(provider), { force: true })
}

/** `sk-ant-…4f2a` for display, never the whole thing. */
export function maskKey(key: string): string {
  if (key.length < 12) return '••••'
  return `${key.slice(0, 7)}${'•'.repeat(16)}${key.slice(-4)}`
}
