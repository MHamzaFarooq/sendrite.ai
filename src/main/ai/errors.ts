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
