/**
 * The AI call. Lives in the main process only -- the renderer never sees an
 * API key and never talks to a provider directly.
 *
 * Each provider in `providers/` validates its own key against that
 * provider's real API and picks a model from the live list it returns --
 * there is no hardcoded model name anywhere in this app.
 */
import type { Provider, RewriteMode } from '@shared/types'
import { systemPrompt, userPrompt, stripPreamble } from './prompts'
import { getApiKey, setApiKey } from '../store'
import { RewriteError } from './errors'
import { anthropicProvider } from './providers/anthropic'
import { openaiProvider } from './providers/openai'
import { googleProvider } from './providers/google'
import type { ProviderClient, ValidateResult } from './providers/types'

export { RewriteError, type RewriteErrorKind } from './errors'

const CLIENTS: Record<Provider, ProviderClient> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider
}

/** Enough room for a rewrite of similar length, with headroom. */
function maxTokensFor(text: string): number {
  return Math.min(4096, Math.max(512, Math.ceil(text.length / 2) + 400))
}

export async function rewrite(opts: {
  text: string
  mode: RewriteMode
  provider: Provider
  model: string
  signal: AbortSignal
}): Promise<string> {
  const { text, mode, provider, model, signal } = opts
  const apiKey = await getApiKey(provider)
  if (!apiKey) throw new RewriteError('No API key saved.', 'no-key')
  if (!model) throw new RewriteError('No model selected. Validate your key in Settings.', 'no-key')

  const out = await CLIENTS[provider].generate({
    apiKey,
    model,
    system: systemPrompt(mode),
    user: userPrompt(text),
    maxTokens: maxTokensFor(text),
    signal
  })

  const cleaned = stripPreamble(out)
  if (!cleaned) throw new RewriteError('The model returned an empty rewrite.', 'unknown')
  return cleaned
}

/**
 * Validates a key against the real provider API and, on success, saves it
 * (encrypted) along with the model chosen for it. This is the only save
 * path for a key -- there is no separate "save without testing."
 */
export async function validateAndSaveKey(provider: Provider, apiKey: string): Promise<ValidateResult> {
  const result = await CLIENTS[provider].validate(apiKey)
  if (result.ok) await setApiKey(provider, apiKey)
  return result
}
