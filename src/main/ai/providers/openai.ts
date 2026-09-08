import OpenAI from 'openai'
import { RewriteError } from '../errors'
import type { GenerateOpts, ProviderClient, ValidateResult } from './types'

/** Excludes non-chat models (embeddings, audio, image, moderation, ...) from the live list. */
const NON_CHAT = /embed|whisper|tts|audio|realtime|image|dall-e|moderation|davinci-002|babbage/i

function pickModel(ids: string[]): string | null {
  const chatModels = ids.filter((id) => /^(gpt-|o\d|chatgpt)/i.test(id) && !NON_CHAT.test(id))
  if (chatModels.length === 0) return null
  // Prefer the fast/cheap tier for a snappy rewrite.
  return (
    chatModels.find((id) => /mini|nano/i.test(id)) ??
    chatModels.find((id) => /^gpt-/i.test(id)) ??
    chatModels[0]
  )
}

function toRewriteError(err: unknown): RewriteError {
  if (err instanceof RewriteError) return err
  if (err instanceof OpenAI.APIUserAbortError || (err as { name?: string })?.name === 'AbortError') {
    return new RewriteError('Cancelled.', 'aborted')
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return new RewriteError('That API key was rejected.', 'auth')
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return new RewriteError('That API key lacks access to this model.', 'auth')
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new RewriteError('Rate limit reached. Try again shortly.', 'rate-limit')
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new RewriteError('Could not reach OpenAI. Check your connection.', 'network')
  }
  if (err instanceof OpenAI.APIError) {
    return new RewriteError(`OpenAI returned ${err.status ?? 'an error'}.`, 'unknown')
  }
  return new RewriteError(err instanceof Error ? err.message : String(err), 'unknown')
}

async function validate(apiKey: string): Promise<ValidateResult> {
  try {
    const client = new OpenAI({ apiKey, maxRetries: 0 })

    const ids: string[] = []
    for await (const m of client.models.list()) ids.push(m.id)
    if (ids.length === 0) return { ok: false, message: 'That key has no models available.' }

    const model = pickModel(ids)
    if (!model) return { ok: false, message: 'No chat-capable model found for this key.' }

    // A model that lists is not guaranteed to generate -- confirm with a
    // trivial real call, the same operation the app will actually make.
    await client.chat.completions.create({
      model,
      max_completion_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }]
    })

    return { ok: true, model }
  } catch (err) {
    return { ok: false, message: toRewriteError(err).message }
  }
}

async function generate(opts: GenerateOpts): Promise<string> {
  const { apiKey, model, system, user, maxTokens, signal } = opts
  try {
    const client = new OpenAI({ apiKey, maxRetries: 1 })

    const response = await client.chat.completions.create(
      {
        model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      },
      { signal }
    )

    const choice = response.choices[0]
    if (choice?.finish_reason === 'content_filter') {
      throw new RewriteError('The model declined to rewrite this text.', 'refused')
    }

    return choice?.message?.content ?? ''
  } catch (err) {
    throw toRewriteError(err)
  }
}

export const openaiProvider: ProviderClient = { validate, generate }
