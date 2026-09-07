import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { Welcome } from './Welcome'
import { SettingsPane } from './SettingsPane'

type Tab = 'welcome' | 'settings'

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<Tab>('welcome')

  useEffect(() => {
    void window.sendrite.getSettings().then((s) => {
      setSettings(s)
      // Returning users land on Settings; first run gets the welcome flow.
      setTab(s.onboarded ? 'settings' : 'welcome')
    })
  }, [])

  const patch = async (p: Partial<Settings>): Promise<void> => {
    setSettings(await window.sendrite.saveSettings(p))
  }

  if (!settings) return <div className="h-full bg-ink-900" />

  return (
    <div className="flex h-full bg-ink-900">
      <nav className="flex w-[76px] flex-col items-center gap-3 border-r border-white/[0.06] bg-black/20 py-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent to-indigo-500 text-lg font-bold text-white shadow-glow">
          S
        </div>
        <div className="my-1 h-px w-8 bg-white/10" />
        <RailButton
          active={tab === 'welcome'}
          onClick={() => setTab('welcome')}
          label="Welcome"
        >
          <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5Z" />
        </RailButton>
        <RailButton
          active={tab === 'settings'}
          onClick={() => setTab('settings')}
          label="Settings"
        >
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
          <path d="m19.4 15-.6 1a1.7 1.7 0 0 1-2 .8l-.7-.2a6.6 6.6 0 0 1-1.7 1l-.1.7a1.7 1.7 0 0 1-1.7 1.4h-1.2a1.7 1.7 0 0 1-1.7-1.4l-.1-.7a6.6 6.6 0 0 1-1.7-1l-.7.2a1.7 1.7 0 0 1-2-.8l-.6-1a1.7 1.7 0 0 1 .4-2.2l.5-.4a6.7 6.7 0 0 1 0-2l-.5-.4a1.7 1.7 0 0 1-.4-2.2l.6-1a1.7 1.7 0 0 1 2-.8l.7.2a6.6 6.6 0 0 1 1.7-1l.1-.7A1.7 1.7 0 0 1 11.4 3h1.2a1.7 1.7 0 0 1 1.7 1.4l.1.7a6.6 6.6 0 0 1 1.7 1l.7-.2a1.7 1.7 0 0 1 2 .8l.6 1a1.7 1.7 0 0 1-.4 2.2l-.5.4a6.7 6.7 0 0 1 0 2l.5.4a1.7 1.7 0 0 1 .4 2.2Z" />
        </RailButton>
      </nav>

      <main className="flex-1 overflow-y-auto">
        {tab === 'welcome' ? (
          <Welcome
            settings={settings}
            onGetStarted={async () => {
              await patch({ onboarded: true })
              setTab('settings')
            }}
            onSkip={() => void patch({ onboarded: true }).then(() => window.sendrite.closeSettings())}
          />
        ) : (
          <SettingsPane settings={settings} patch={patch} />
        )}
      </main>
    </div>
  )
}

function RailButton({
  active,
  onClick,
  label,
  children
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-xl transition ${
        active
          ? 'bg-accent text-white shadow-glow'
          : 'border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-slate-200'
      }`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  )
}
