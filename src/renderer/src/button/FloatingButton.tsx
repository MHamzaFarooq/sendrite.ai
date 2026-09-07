import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ButtonState, RewriteMode } from "@shared/types";

const MODE: RewriteMode = "improve";

/** Swaps the working-state label the longer a rewrite takes, so a slow
    model call reads as progress instead of a stuck spinner. */
const WORKING_LABELS: [ms: number, label: string][] = [
  [0, "Rewriting…"],
  [3000, "Still working…"],
  [7000, "Almost there…"],
];

function useWorkingLabel(active: boolean): string {
  const [label, setLabel] = useState(WORKING_LABELS[0][1]);

  useEffect(() => {
    if (!active) {
      setLabel(WORKING_LABELS[0][1]);
      return;
    }
    const timers = WORKING_LABELS.slice(1).map(([ms, text]) =>
      setTimeout(() => setLabel(text), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return label;
}

export function FloatingButton(): JSX.Element | null {
  const [state, setState] = useState<ButtonState>({ phase: "idle" });
  const shellRef = useRef<HTMLDivElement>(null);
  const workingLabel = useWorkingLabel(state.phase === "working");

  useEffect(() => window.sendrite.onButtonState(setState), []);

  // The window is sized to its content, so the transparent region around the
  // pill never swallows clicks meant for the app underneath.
  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const report = (): void => {
      const r = el.getBoundingClientRect();
      void window.sendrite.resizeButton(
        Math.ceil(r.width) + 16,
        Math.ceil(r.height) + 16,
      );
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (state.phase === "idle") return null;

  const run = (): void => {
    void window.sendrite.runRewrite(MODE);
  };

  return (
    <div className="flex h-full w-full items-start justify-start p-2">
      <div
        ref={shellRef}
        className="animate-pop inline-flex items-center gap-2"
      >
        {/* Rekeyed per phase so ready/working/error swaps get a soft settle
            instead of a hard cut. Shadow lives on each individual pill, not
            this wrapper -- a shared shadow across two side-by-side pills
            renders as one wrong blob. */}
        <div
          key={state.phase}
          className="animate-pop-fast inline-flex items-center gap-2"
        >
          {state.phase === "working" ? (
            <div className="inline-flex items-center gap-2.5 rounded-full bg-accent py-2.5 pl-4 pr-2 text-sm font-semibold text-white ">
              <Spinner />
              <span>{workingLabel}</span>
              <button
                onClick={() => void window.sendrite.dismissButton()}
                aria-label="Cancel rewrite"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/70 transition duration-150 hover:bg-white/20 hover:text-white active:scale-[0.92]"
              >
                <CrossIcon size={12} />
              </button>
            </div>
          ) : state.phase === "error" ? (
            <button
              onClick={() => void window.sendrite.dismissButton()}
              className="inline-flex max-w-[280px] items-center gap-2 rounded-full bg-red-500/95 py-2.5 pl-3.5 pr-4 text-left text-sm font-medium text-white shadow-pill"
            >
              <WarningIcon />
              <span className="truncate">{state.message}</span>
            </button>
          ) : (
            <>
              <button
                onClick={run}
                title={state.preview}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white  transition duration-150 hover:bg-accent-soft active:scale-[0.98]"
              >
                <Sparkle />
                Rewrite
              </button>
              <button
                onClick={() => void window.sendrite.dismissButton()}
                aria-label="Dismiss"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-800/90 text-white/70  transition duration-150 hover:bg-ink-700 hover:text-white active:scale-[0.98]"
              >
                <CrossIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Sparkle(): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" />
    </svg>
  );
}

function WarningIcon(): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function CrossIcon({ size = 11 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      className="animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.3"
        fill="none"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
