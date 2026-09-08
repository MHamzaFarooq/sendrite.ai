import type { Settings } from "@shared/types";
import { prettyHotkey } from "./hotkey";
import logo from "../assets/logo.svg";

interface Props {
  settings: Settings;
  onGetStarted: () => void;
}

export function Welcome({ settings, onGetStarted }: Props): JSX.Element {
  const steps = [
    "Select the text you want to improve",
    null, // rendered specially, contains the hotkey chip
    "Click the rewrite button and send it!",
  ];

  return (
    <div className="animate-fade-in mx-auto flex min-h-full max-w-[620px] flex-col px-10 py-8">
      <div className="mt-8 flex flex-col items-center text-center">
        <img src={logo} alt="" className="h-24 w-auto" />
        <p className="mt-7 text-2xl text-slate-400">Welcome to</p>
        <h1 className="text-[42px] font-bold leading-tight tracking-wide text-white">
          Sendrite.ai
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-400">
          Write better, wherever you work.
          <br />
          Polish your messages with AI without leaving the app.
        </p>
      </div>

      <ol className="mt-9 space-y-3">
        {steps.map((label, i) => (
          <li
            key={i}
            className="flex items-center gap-4 rounded-2xl bg-white/[0.03] px-5 py-4"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-sm font-semibold text-accent">
              {i + 1}
            </span>
            {label ? (
              <span className="text-[17px] text-slate-200">{label}</span>
            ) : (
              <span className="flex items-center gap-3 text-[17px] text-slate-200">
                Press your shortcut
                <kbd className="kbd">{prettyHotkey(settings.hotkey)}</kbd>
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <button onClick={onGetStarted} className="btn-primary w-full">
          Set up Sendrite
        </button>
      </div>
    </div>
  );
}
