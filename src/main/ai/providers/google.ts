import { ApiError, GoogleGenAI } from '@google/genai'
import { RewriteError } from '../errors'
import type { GenerateOpts, ProviderClient, ValidateResult } from './types'

/** Excludes non-text models (embeddings, image, tts, live audio, ...) from the live list. */
const NON_TEXT = /embed|image|tts|live|audio/i

function pickModel(names: string[]): string | null {
  // Resource names come back as "models/gemini-2.0-flash" -- the API wants
  // just the trailing id.
  const ids = names.map((n) => n.replace(/^models\//, ''))
  const candidates = ids.filter((id) => /^gemini-/i.test(id) && !NON_TEXT.test(id))
  if (candidates.length === 0) return null
  // Prefer the fast tier for a snappy rewrite.
  return candidates.find((id) => /flash/i.test(id)) ?? candidates[0]
}

function toRewriteError(err: unknown): RewriteError {
  if (err instanceof RewriteError) return err
  if ((err as { name?: string })?.name === 'AbortError') {
    return new RewriteError('Cancelled.', 'aborted')
  }
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return new RewriteError('That API key was rejected.', 'auth')
    }
    if (err.status === 429) {
      return new RewriteError('Rate limit reached. Try again shortly.', 'rate-limit')
    }
    if (err.status >= 500) {
      return new RewriteError('Could not reach Gemini. Check your connection.', 'network')
    }
    return new RewriteError(err.message || `Gemini returned ${err.status}.`, 'unknown')
  }
  return new RewriteError(err instanceof Error ? err.message : String(err), 'unknown')
}

async function validate(apiKey: string): Promise<ValidateResult> {
  try {
    const client = new GoogleGenAI({ apiKey })

    const names: string[] = []
    for await (const m of await client.models.list()) {
      if (m.name) names.push(m.name)
    }
    if (names.length === 0) return { ok: false, message: 'That key has no models available.' }

    const model = pickModel(names)
    if (!model) return { ok: false, message: 'No text-capable model found for this key.' }

    // A model that lists is not guaranteed to generate -- confirm with a
    // trivial real call, the same operation the app will actually make.
    await client.models.generateContent({
      model,
      contents: 'Reply with the single word: ok',
      config: { maxOutputTokens: 8 }
    })

    return { ok: true, model }
  } catch (err) {
    return { ok: false, message: toRewriteError(err).message }
  }
}

async function generate(opts: GenerateOpts): Promise<string> {
  const { apiKey, model, system, user, maxTokens, signal } = opts
  try {
    const client = new GoogleGenAI({ apiKey })

    const response = await client.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        abortSignal: signal
      }
    })

    return response.text ?? ''
  } catch (err) {
    throw toRewriteError(err)
  }
}

export const googleProvider: ProviderClient = { validate, generate }
