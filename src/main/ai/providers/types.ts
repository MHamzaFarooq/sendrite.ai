export interface ValidateResult {
  ok: boolean
  /** The model chosen automatically from this key's live model list. Present iff ok. */
  model?: string
  /** Human-readable failure reason. Present iff !ok. */
  message?: string
}

export interface GenerateOpts {
  apiKey: string
  model: string
  system: string
  user: string
  maxTokens: number
  signal: AbortSignal
}

/**
 * One implementation per AI provider. There is deliberately no hardcoded
 * model list anywhere -- `validate` calls the provider's own model-listing
 * endpoint and picks a fast default from whatever it actually returns.
 */
export interface ProviderClient {
  validate(apiKey: string): Promise<ValidateResult>
  generate(opts: GenerateOpts): Promise<string>
}
