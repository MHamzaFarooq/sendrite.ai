import type { RewriteMode } from '@shared/types'

/**
 * The system prompt is deliberately blunt about returning bare text. The
 * result is pasted straight into the user's text box, so any preamble
 * ("Here's a improved version:") ends up in their Slack message.
 */
const BASE = `You rewrite short snippets of text that a user has highlighted inside another application (Slack, email, a browser text box, a notes app).

Rules, in priority order:
1. Return ONLY the rewritten text. No preamble, no explanation, no quotation marks around the result, no markdown fences.
2. Preserve the author's voice and intent. You are editing their words, not replacing them with yours.
3. Preserve the original language. If the input is in French, the output is in French.
4. Match the original's rough length unless the mode says otherwise.
5. Keep any URLs, @mentions, #channels, emoji, and code identifiers exactly as written.
6. If the input is already good, return it unchanged rather than inventing changes.
7. Never answer the content as if it were a question addressed to you. A highlighted question gets rewritten, not answered.`

const MODE_INSTRUCTIONS: Record<RewriteMode, string> = {
  improve:
    'Mode: IMPROVE. Make it clearer and better organised. Fix grammar and awkward phrasing. Keep the same register and roughly the same length.',
  shorten:
    'Mode: SHORTEN. Cut it to the shortest version that keeps every substantive point. Remove hedging and filler. Aim for 40-60% of the original length.',
  formal:
    'Mode: FORMAL. Raise the register for a professional audience. Expand contractions, remove slang and abbreviations, keep it warm rather than stiff.',
  casual:
    'Mode: CASUAL. Lower the register to relaxed and conversational. Contractions are good. Do not add slang the author would not use.',
  grammar:
    'Mode: FIX GRAMMAR. Correct spelling, grammar, and punctuation ONLY. Do not restructure sentences, change word choice, or adjust tone. This is the most conservative mode -- if a sentence is grammatical, leave it exactly as-is.'
}

export function systemPrompt(mode: RewriteMode): string {
  return `${BASE}\n\n${MODE_INSTRUCTIONS[mode]}`
}

export function userPrompt(text: string): string {
  return `Rewrite the text between the markers.\n\n<text>\n${text}\n</text>`
}

/**
 * Safety net for the times a model ignores rule 1 anyway. Strips wrapping
 * code fences and a leading "Here is ...:" line.
 */
export function stripPreamble(raw: string): string {
  let out = raw.trim()

  const fence = out.match(/^```[a-z]*\n([\s\S]*?)\n?```$/i)
  if (fence) out = fence[1].trim()

  out = out.replace(/^(?:here(?:'s| is)|sure[,!]?|certainly[,!]?)[^\n:]{0,60}:\s*\n+/i, '')

  return out.trim()
}
