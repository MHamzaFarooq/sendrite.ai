/**
 * The Claude call. Lives in the main process only -- the renderer never sees
 * an API key and never talks to Anthropic directly.
 *
 * The user's own key, read from OS-encrypted storage, direct to Anthropic.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ModelId, RewriteMode } from '@shared/types'
import { systemPrompt, userPrompt, stripPreamble } from './prompts'
import { getApiKey } from '../store'

export type RewriteErrorKind =
  | 'no-key'
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'refused'
  | 'aborted'
  | 'unknown'

export class RewriteError extends Error {
  constructor(
    message: string,
    readonly kind: RewriteErrorKind
  ) {
    super(message)
    this.name = 'RewriteError'
  }
}

/**
 * Models differ in how you ask them to be quick.
 *
 * Haiku 4.5 has no thinking by default and rejects `effort`, so it gets
 * nothing. Sonnet 5 and Opus 5 run adaptive thinking by default, which is
 * seconds we cannot spend on a one-line rewrite -- `effort: 'low'` keeps the
 * quality of the bigger model without the deliberation.
 */
function speedParams(model: ModelId): Record<string, unknown> {
  return model === 'claude-haiku-4-5' ? {} : { output_config: { effort: 'low' } }
}

/** Enough room for a rewrite of similar length, with headroom. */
function maxTokensFor(text: string): number {
  return Math.min(4096, Math.max(512, Math.ceil(text.length / 2) + 400))
}

/**
 * Most-specific-first. Collapsing these into one `APIError` catch would lose
 * the distinction between retryable (429, 5xx, network) and terminal (401)
 * failures, which is exactly what the button needs to tell the user.
 */
function toRewriteError(err: unknown): RewriteError {
  if (err instanceof RewriteError) return err

  // We abort on dismiss and on session timeout; neither is a real failure.
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

export async function rewrite(opts: {
  text: string
  mode: RewriteMode
  model: ModelId
  signal: AbortSignal
}): Promise<string> {
  const { text, mode, model, signal } = opts
  const apiKey = await getApiKey()
  if (!apiKey) throw new RewriteError('No API key saved.', 'no-key')

  try {
    const client = new Anthropic({ apiKey, maxRetries: 1 })

    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokensFor(text),
        system: systemPrompt(mode),
        messages: [{ role: 'user', content: userPrompt(text) }],
        ...speedParams(model)
      } as Anthropic.MessageCreateParamsNonStreaming,
      { signal }
    )

    if (response.stop_reason === 'refusal') {
      throw new RewriteError('The model declined to rewrite this text.', 'refused')
    }

    const out = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const cleaned = stripPreamble(out)
    if (!cleaned) throw new RewriteError('The model returned an empty rewrite.', 'unknown')
    return cleaned
  } catch (err) {
    throw toRewriteError(err)
  }
}

/** Used by the "Test" button in settings. */
export async function testApiKey(apiKey: string, model: ModelId): Promise<string> {
  const client = new Anthropic({ apiKey, maxRetries: 0 })
  await client.messages.create({
    model,
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Reply with the single word: ok' }]
  })
  return model
}
