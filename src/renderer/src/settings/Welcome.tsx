import type { Settings } from '@shared/types'
import { prettyHotkey } from './hotkey'

interface Props {
  settings: Settings
  onGetStarted: () => void
  onSkip: () => void
}

export function Welcome({ settings, onGetStarted, onSkip }: Props): JSX.Element {
  const steps = [
    'Highlight the text you want to improve',
    null, // rendered specially, contains the hotkey chip
    'Click the button that appears — text is replaced'
  ]

  return (
    <div className="animate-fade-in mx-auto flex min-h-full max-w-[620px] flex-col px-10 py-8">
      <header className="flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">WELCOME</span>
        <span className="text-xs text-slate-600">v1.0</span>
      </header>

      <div className="mt-8 flex flex-col items-center text-center">
        <div className="h-[132px] w-[132px] rounded-full bg-[conic-gradient(from_180deg,#4aa8ff,#a855f7,#ec4899,#22d3ee,#4aa8ff)] blur-[0.5px]" />
        <p className="mt-7 text-2xl text-slate-400">Welcome to</p>
        <h1 className="text-[42px] font-bold leading-tight tracking-tight text-white">
          Sendrite.ai
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-400">
          Rewrite any text, in any app,
          <br />
          without leaving the window.
        </p>
      </div>

      <ol className="mt-9 space-y-3">
        {steps.map((label, i) => (
          <li key={i} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] px-5 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-sm font-semibold text-accent">
              {i + 1}
            </span>
            {label ? (
              <span className="text-[17px] text-slate-200">{label}</span>
            ) : (
              <span className="flex items-center gap-3 text-[17px] text-slate-200">
                Press
                <kbd className="kbd">{prettyHotkey(settings.hotkey)}</kbd>
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex gap-3">
        <button onClick={onGetStarted} className="btn-primary flex-1">
          Get started
        </button>
        <button onClick={onSkip} className="btn-ghost">
          Skip
        </button>
      </div>
    </div>
  )
}
