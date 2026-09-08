import Anthropic from '@anthropic-ai/sdk'
import { RewriteError } from '../errors'
import type { GenerateOpts, ProviderClient, ValidateResult } from './types'

/**
 * Sonnet 5 and Opus 5 run adaptive thinking by default, which is seconds we
 * cannot spend on a one-line rewrite -- `effort: 'low'` keeps the quality of
 * the bigger model without the deliberation. Haiku has no thinking to begin
 * with and rejects the param outright.
 */
function speedParams(model: string): Record<string, unknown> {
  return model.includes('haiku') ? {} : { output_config: { effort: 'low' } }
}

function toRewriteError(err: unknown): RewriteError {
  if (err instanceof RewriteError) return err
  if (err instanceof Anthropic.APIUserAbortError || (err as { name?: string })?.name === 'AbortError') {
    return new RewriteError('Cancelled.', 'aborted')
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new RewriteError('That API key was rejected.', 'auth')
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new RewriteError('That API key lacks access to this model.', 'auth')
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new RewriteError('Rate limit reached. Try again shortly.', 'rate-limit')
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new RewriteError('Could not reach Anthropic. Check your connection.', 'network')
  }
  if (err instanceof Anthropic.APIError) {
    return new RewriteError(`Anthropic returned ${err.status ?? 'an error'}.`, 'unknown')
  }
  return new RewriteError(err instanceof Error ? err.message : String(err), 'unknown')
}

async function validate(apiKey: string): Promise<ValidateResult> {
  try {
    const client = new Anthropic({ apiKey, maxRetries: 0 })

    const ids: string[] = []
    for await (const m of client.models.list()) ids.push(m.id)
    if (ids.length === 0) return { ok: false, message: 'That key has no models available.' }

    // Anthropic lists newest-first; prefer the fast tier for a snappy rewrite.
    const model = ids.find((id) => id.includes('haiku')) ?? ids[0]

    // A model that lists is not guaranteed to generate -- confirm with a
    // trivial real call, the same operation the app will actually make.
    await client.messages.create({
      model,
      max_tokens: 8,
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
    const client = new Anthropic({ apiKey, maxRetries: 1 })

    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
        ...speedParams(model)
      } as Anthropic.MessageCreateParamsNonStreaming,
      { signal }
    )

    if (response.stop_reason === 'refusal') {
      throw new RewriteError('The model declined to rewrite this text.', 'refused')
    }

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
  } catch (err) {
    throw toRewriteError(err)
  }
}

export const anthropicProvider: ProviderClient = { validate, generate }
