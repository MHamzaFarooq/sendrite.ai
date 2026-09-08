import { useEffect, useRef, useState } from "react";
import {
  MODELS,
  MODEL_LABELS,
  type PermissionStatus,
  type Settings,
} from "@shared/types";
import { hotkeyWarning, prettyHotkey, toAccelerator } from "./hotkey";

interface Props {
  settings: Settings;
  keySaved: boolean;
  onKeySavedChange: (v: boolean) => void;
  patch: (p: Partial<Settings>) => Promise<void>;
}

type TestState = {
  status: "idle" | "validating" | "ok" | "fail";
  message: string;
};

export function SettingsPane({
  settings,
  keySaved,
  onKeySavedChange,
  patch,
}: Props): JSX.Element {
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle", message: "" });

  useEffect(() => {
    void window.sendrite.getPermissions().then(setPerms);
  }, []);

  const runTest = async (): Promise<void> => {
    const key = keyInput.trim();
    if (!key) return;
    setTest({ status: "validating", message: "" });
    const result = await window.sendrite.testApiKey(key, settings.model);
    if (result.ok) {
      await window.sendrite.setApiKey(key);
      onKeySavedChange(true);
      setKeyInput("");
      setTest({
        status: "ok",
        message: `Key valid — ${MODEL_LABELS[settings.model].split("·")[0].trim()}`,
      });
    } else {
      setTest({ status: "fail", message: result.message });
    }
  };

  return (
    <div className="animate-fade-in mx-auto max-w-[640px] px-10 py-8">
      <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">
        SETTINGS
      </span>
      <h1 className="mt-2 text-[34px] font-bold tracking-tight text-white">
        Shortcut
      </h1>
      <p className="mt-1 text-[17px] text-slate-400">
        Summons the rewrite button next to your selected text.
      </p>

      <HotkeyRecorder
        value={settings.hotkey}
        onChange={(next) => void patch({ hotkey: next })}
      />

      {perms && <PermissionNotice perms={perms} />}

      <div className="my-8 h-px bg-white/[0.07]" />

      <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">
        AI MODEL
      </span>

      {!keySaved && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-5 py-4">
          <WarningIcon />
          <p className="text-[15px] text-amber-200">
            Add your Claude API key below — Sendrite can't rewrite anything
            until you do.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <OptionCard
          attention={!keySaved}
          title="Use my own Claude API key"
          badge={
            keySaved ? (
              <span className="text-sm font-medium text-emerald-400">
                ✓ Active
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                Required
              </span>
            )
          }
        >
          <div className="mt-4 flex gap-2.5">
            <div className="relative flex-1">
              <input
                type={reveal ? "text" : "password"}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setTest({ status: "idle", message: "" });
                }}
                placeholder={
                  keySaved ? "sk-ant-•••••••••••••••• (saved)" : "sk-ant-..."
                }
                className="field pr-11 font-mono"
                spellCheck={false}
              />
              <button
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? "Hide key" : "Show key"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <EyeIcon off={reveal} />
              </button>
            </div>
            <button
              onClick={() => void runTest()}
              disabled={!keyInput.trim() || test.status === "validating"}
              className="btn-ghost shrink-0"
            >
              {test.status === "validating" ? "Validating…" : "Validate"}
            </button>
          </div>

          {test.status === "ok" && (
            <p className="mt-2.5 text-sm text-emerald-400">✓ {test.message}</p>
          )}
          {test.status === "fail" && (
            <p className="mt-2.5 text-sm text-red-400">✕ {test.message}</p>
          )}
          {keySaved && test.status === "idle" && (
            <button
              onClick={() => {
                void window.sendrite
                  .clearApiKey()
                  .then(() => onKeySavedChange(false));
              }}
              className="mt-2.5 text-sm text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              Remove saved key
            </button>
          )}

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Stored encrypted by{" "}
            {perms?.platform === "darwin"
              ? "the macOS Keychain"
              : "Windows DPAPI"}
            , never in plain text.
          </p>
        </OptionCard>

        <OptionCard
          disabled
          title="Use Sendrite's key"
          badge={
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-400">
              Coming soon
            </span>
          }
        >
          <p className="mt-1 text-[15px] text-slate-500">
            No setup required. We're still building this — use your own key
            above for now.
          </p>
        </OptionCard>
      </div>

      <div className="mt-6 space-y-3">
        <Toggle
          checked={settings.instantMode}
          onChange={(v) => void patch({ instantMode: v })}
          title="Instant mode"
          detail="Skip the button and rewrite the moment you press the hotkey."
        />
        <Toggle
          checked={settings.prefetch}
          onChange={(v) => void patch({ prefetch: v })}
          title="Predictive prefetch"
          detail="Start the rewrite while you reach for the button, so it feels instant. Costs a fraction of a cent for abandoned rewrites."
        />
      </div>

      <div className="mt-6">
        <label className="text-sm text-slate-400">Available Models</label>
        <div className="relative mt-2">
          <select
            value={settings.model}
            onChange={(e) =>
              void patch({ model: e.target.value as Settings["model"] })
            }
            className="field appearance-none pr-10"
          >
            {MODELS.map((m) => (
              <option key={m} value={m} className="bg-ink-700">
                {MODEL_LABELS[m]}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <button
        onClick={() => void window.sendrite.closeSettings()}
        className="btn-primary mt-8 w-full"
      >
        Done
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HotkeyRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const accelerator = toAccelerator(e);
      if (!accelerator) return;

      const warn = hotkeyWarning(accelerator);
      setWarning(warn);
      if (!warn) {
        onChange(accelerator);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-medium text-slate-200">
          Rewrite selection
        </span>
        <span className="text-sm text-slate-500">Global</span>
      </div>

      <button
        ref={ref}
        onClick={() => {
          setWarning(null);
          setRecording(true);
        }}
        className={`mt-4 flex w-full items-center gap-2 rounded-xl border px-5 py-4 transition ${
          recording
            ? "border-accent bg-accent/10 ring-2 ring-accent/25"
            : "border-white/10 bg-black/40 hover:border-white/20"
        }`}
      >
        {recording ? (
          <span className="text-slate-400">Press a combination…</span>
        ) : (
          prettyHotkey(value)
            .split(" ")
            .map((part) => (
              <kbd key={part} className="kbd">
                {part}
              </kbd>
            ))
        )}
      </button>

      {warning ? (
        <p className="mt-3 text-sm text-amber-400">{warning}</p>
      ) : (
        <p className="mt-3 text-sm text-accent">Click the field to change</p>
      )}
    </div>
  );
}

function PermissionNotice({ perms }: { perms: PermissionStatus }): JSX.Element {
  if (perms.platform !== "darwin") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] px-5 py-4">
        <InfoIcon />
        <p className="text-[15px] text-slate-300">
          No conflicts. Windows needs no extra permission.
        </p>
      </div>
    );
  }

  if (perms.accessibility) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-4">
        <InfoIcon />
        <p className="text-[15px] text-slate-300">
          No conflicts. Accessibility permission granted.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-5 py-4">
      <p className="text-[15px] text-amber-200">
        Sendrite needs Accessibility permission to read your selection and paste
        the result.
      </p>
      <button
        onClick={() => void window.sendrite.requestAccessibility()}
        className="btn-ghost mt-3 py-2 text-sm"
      >
        Open System Settings
      </button>
    </div>
  );
}

function OptionCard({
  disabled,
  attention,
  title,
  badge,
  children,
}: {
  disabled?: boolean;
  attention?: boolean;
  title: string;
  badge: React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        disabled
          ? "border-white/[0.05] bg-white/[0.015] opacity-60"
          : attention
            ? "border-amber-400/50 bg-amber-500/[0.06]"
            : "border-accent/45 bg-accent/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={`flex-1 text-[17px] font-semibold ${disabled ? "text-slate-400" : "text-white"}`}
        >
          {title}
        </span>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail: string;
}): JSX.Element {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-white/15"
    >
      <span
        className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-accent" : "bg-slate-700"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
      <span>
        <span className="block text-[15px] font-medium text-slate-200">
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
          {detail}
        </span>
      </span>
    </button>
  );
}

function InfoIcon(): JSX.Element {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="mt-0.5 shrink-0 text-accent"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon(): JSX.Element {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-amber-400"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m3 3 18 18" />}
    </svg>
  );
}
