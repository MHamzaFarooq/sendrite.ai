import { ApiError, GoogleGenAI } from '@google/genai'
import { RewriteError } from '../errors'
import type { GenerateOpts, ProviderClient, ValidateResult } from './types'

/** Excludes non-text models (embeddings, image, tts, live audio, ...) from the live list. */
const NON_TEXT = /embed|image|tts|live|audio/i

/**
 * Ranks candidate model ids best-first: fast tier before others, newest
 * version before older. The list endpoint keeps listing retired models long
 * after they 404 on generate, so this is a heuristic starting point, not a
 * guarantee -- `validate` still has to fall through the list on a 404.
 */
function pickModelCandidates(names: string[]): string[] {
  // Resource names come back as "models/gemini-2.0-flash" -- the API wants
  // just the trailing id.
  const ids = names.map((n) => n.replace(/^models\//, ''))
  const candidates = ids.filter((id) => /^gemini-/i.test(id) && !NON_TEXT.test(id))
  const version = (id: string): number => {
    const m = id.match(/gemini-(\d+(?:\.\d+)?)/)
    return m ? parseFloat(m[1]) : 0
  }
  return [...candidates].sort((a, b) => {
    const flashDelta = Number(/flash/i.test(b)) - Number(/flash/i.test(a))
    return flashDelta !== 0 ? flashDelta : version(b) - version(a)
  })
}

/** ApiError#message is `JSON.stringify({ error: { message, status, ... } })`. */
function extractGoogleErrorMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    return parsed.error?.message ?? null
  } catch {
    return null
  }
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
      // Gemini returns 429 (RESOURCE_EXHAUSTED) for both a transient rate
      // limit and a permanently exhausted free-tier quota. The SDK doesn't
      // distinguish them structurally, but Google's own message text does --
      // surface it instead of a generic "try again" that may be wrong.
      const detail = extractGoogleErrorMessage(err.message)
      return new RewriteError(
        detail ? `Rate limit or quota exceeded: ${detail}` : 'Rate limit reached. Try again shortly.',
        'rate-limit'
      )
    }
    if (err.status >= 500) {
      return new RewriteError('Could not reach Gemini. Check your connection.', 'network')
    }
    if (err.status === 404) {
      return new RewriteError(
        'This model is no longer available. Re-validate your key in Settings to pick a new one.',
        'unknown'
      )
    }
    return new RewriteError(
      extractGoogleErrorMessage(err.message) || err.message || `Gemini returned ${err.status}.`,
      'unknown'
    )
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

    const candidates = pickModelCandidates(names)
    if (candidates.length === 0) return { ok: false, message: 'No text-capable model found for this key.' }

    for (const model of candidates) {
      try {
        // A model that lists is not guaranteed to generate -- confirm with a
        // trivial real call, the same operation the app will actually make.
        await client.models.generateContent({
          model,
          contents: 'Reply with the single word: ok',
          config: { maxOutputTokens: 8 }
        })
        return { ok: true, model }
      } catch (err) {
        // A retired-but-still-listed model reports 404 -- try the next
        // candidate. Any other error (auth, rate-limit, ...) is about the
        // key itself, not this particular model, so stop immediately.
        if (err instanceof ApiError && err.status === 404) continue
        return { ok: false, message: toRewriteError(err).message }
      }
    }
    return { ok: false, message: `None of this key's ${candidates.length} available models could be used.` }
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
