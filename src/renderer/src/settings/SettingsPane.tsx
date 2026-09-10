import { useEffect, useRef, useState } from "react";
import {
  PROVIDERS,
  PROVIDER_LABELS,
  type PermissionStatus,
  type Provider,
  type Settings,
} from "@shared/types";
import { hotkeyWarning, prettyHotkey, toAccelerator } from "./hotkey";

interface Props {
  settings: Settings;
  /** Does the currently active provider have a working key? Lifted to App so the sidebar can nag. */
  keySaved: boolean;
  onKeySavedChange: (v: boolean) => void;
  patch: (p: Partial<Settings>) => Promise<void>;
}

const KEY_PLACEHOLDERS: Record<Provider, string> = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  google: "AIza...",
};

const KEY_SIGNUP_URLS: Record<Provider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/apikey",
};

export function SettingsPane({
  settings,
  keySaved,
  onKeySavedChange,
  patch,
}: Props): JSX.Element {
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  // Whether each provider has a key saved at all, independent of which one
  // is currently active -- switching providers should not lose the others.
  const [savedByProvider, setSavedByProvider] = useState<Record<Provider, boolean> | null>(null);
  // Which provider's card is showing. Defaults to whichever is active, but
  // browsing to another tab doesn't switch the active provider by itself --
  // only a successful Validate on that tab does.
  const [viewedProvider, setViewedProvider] = useState<Provider>(settings.provider);

  useEffect(() => {
    void window.sendrite.getPermissions().then(setPerms);
    void Promise.all(PROVIDERS.map((p) => window.sendrite.hasApiKey(p))).then((results) => {
      setSavedByProvider(Object.fromEntries(PROVIDERS.map((p, i) => [p, results[i]])) as Record<
        Provider,
        boolean
      >);
    });
  }, []);

  // Keep the sidebar reminder dot in sync with whichever provider is active.
  useEffect(() => {
    if (savedByProvider) onKeySavedChange(savedByProvider[settings.provider]);
  }, [savedByProvider, settings.provider, onKeySavedChange]);

  const handleValidated = async (provider: Provider): Promise<void> => {
    setSavedByProvider((prev) => (prev ? { ...prev, [provider]: true } : prev));
    // The main process already made this provider active and picked a model;
    // pull that into renderer state too.
    await patch({ provider });
  };

  const handleCleared = (provider: Provider): void => {
    setSavedByProvider((prev) => (prev ? { ...prev, [provider]: false } : prev));
  };

  // Switch the active provider without re-validating -- only possible once
  // that provider's key has already passed validation at least once.
  const handleActivate = async (provider: Provider): Promise<void> => {
    await patch({ provider, model: settings.models[provider] ?? "" });
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
        AI PROVIDER
      </span>

      {!keySaved && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-5 py-4">
          <WarningIcon />
          <p className="text-[15px] text-amber-200">
            Pick a provider below, paste your API key, and validate it —
            Sendrite can't rewrite anything until you do.
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-1.5 rounded-2xl bg-white/[0.03] p-1.5">
        {PROVIDERS.map((provider) => (
          <button
            key={provider}
            onClick={() => setViewedProvider(provider)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              viewedProvider === provider
                ? "bg-accent text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {PROVIDER_LABELS[provider]}
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                savedByProvider?.[provider] ? "bg-emerald-400" : "bg-white/20"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mt-3">
        <ProviderCard
          provider={viewedProvider}
          active={settings.provider === viewedProvider}
          keySaved={savedByProvider?.[viewedProvider] ?? false}
          perms={perms}
          onValidated={() => void handleValidated(viewedProvider)}
          onCleared={() => handleCleared(viewedProvider)}
          onActivate={() => void handleActivate(viewedProvider)}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Sendrite's own key (no setup, subscription-based) is coming soon.
      </p>

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

type ValidateState = {
  status: "idle" | "validating" | "ok" | "fail";
  message: string;
};

function ProviderCard({
  provider,
  active,
  keySaved,
  perms,
  onValidated,
  onCleared,
  onActivate,
}: {
  provider: Provider;
  active: boolean;
  keySaved: boolean;
  perms: PermissionStatus | null;
  onValidated: () => void;
  onCleared: () => void;
  onActivate: () => void;
}): JSX.Element {
  const [keyInput, setKeyInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [test, setTest] = useState<ValidateState>({ status: "idle", message: "" });

  const runValidate = async (): Promise<void> => {
    const key = keyInput.trim();
    if (!key) return;
    setTest({ status: "validating", message: "" });
    const result = await window.sendrite.validateApiKey(provider, key);
    if (result.ok) {
      setKeyInput("");
      setTest({ status: "ok", message: "Connected." });
      onValidated();
    } else {
      setTest({ status: "fail", message: result.message ?? "That key was rejected." });
    }
  };

  return (
    <OptionCard
      attention={active && !keySaved}
      title={PROVIDER_LABELS[provider]}
      badge={
        active && keySaved ? (
          <span className="text-sm font-medium text-emerald-400">✓ Active</span>
        ) : keySaved ? (
          <button
            onClick={onActivate}
            className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent transition hover:bg-accent/25"
          >
            Activate
          </button>
        ) : (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
            Not connected
          </span>
        )
      }
    >
      <p className="mt-1.5 text-sm text-slate-500">
        Needs an API key from {PROVIDER_LABELS[provider]}.{" "}
        <a
          href={KEY_SIGNUP_URLS[provider]}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Get one here
        </a>
      </p>

      <div className="mt-4 flex gap-2.5">
        <div className="relative flex-1">
          <input
            type={reveal ? "text" : "password"}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              setTest({ status: "idle", message: "" });
            }}
            placeholder={keySaved ? "•••••••••••••••• (saved)" : KEY_PLACEHOLDERS[provider]}
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
          onClick={() => void runValidate()}
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
            void window.sendrite.clearApiKey(provider).then(onCleared);
          }}
          className="mt-2.5 text-sm text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
        >
          Remove saved key
        </button>
      )}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Stored encrypted by{" "}
        {perms?.platform === "darwin" ? "the macOS Keychain" : "Windows DPAPI"}, never in plain
        text.
      </p>
    </OptionCard>
  );
}

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
            : "border-white/[0.07] bg-white/[0.02]"
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
