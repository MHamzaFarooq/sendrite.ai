# Sendrite

Rewrite any text, in any app, without leaving the window.

Highlight text anywhere — Slack, a LinkedIn post, your notes app — press the hotkey, and a
small button appears. Click it and the highlighted text is replaced with an AI-improved
version.

Windows and macOS. See [ARCHITECTURE.md](ARCHITECTURE.md) for how it works.

## Setup

```bash
npm install
node scripts/make-icons.mjs   # placeholder tray icons, run once
npm run dev
```

The app starts in the tray (menu bar on macOS) and opens the welcome window on first run.

1. Paste an Anthropic API key in **Settings → Use my own Claude API key** and hit **Test**
2. Highlight text in any app
3. Press `Ctrl+Alt+Space` (`⌘⌥Space` on macOS)

Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys).

### macOS only

macOS gates synthetic keystrokes behind Accessibility permission. Settings will detect
this and link you straight to the right pane in System Settings. Grant it to **Sendrite**
(or to your terminal / Electron binary while developing), then restart the app.

Windows needs no equivalent permission.

## Troubleshooting

**`TypeError: Cannot read properties of undefined (reading 'isPackaged')`**

VS Code's integrated terminal exports `ELECTRON_RUN_AS_NODE=1`, which makes Electron boot
as a plain Node process — so `require('electron')` returns a path string instead of the
API. `npm run dev` and `npm run start` go through [`scripts/run.mjs`](scripts/run.mjs),
which strips the variable. If you invoke `electron-vite` directly, unset it first.

**Nothing happens when I press the hotkey**

Run `npm run smoke` to check the native bridge resolves. If the hotkey itself is taken by
another app, Sendrite shows a dialog at startup and opens Settings — pick another combo.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm run smoke` | Regenerate icons and verify the native bridge |
| `npm run typecheck` | Type-check main, preload and renderer |
| `npm run build` | Type-check, then bundle to `out/` |
| `npm run pack:win` | Build an NSIS installer into `release/` |
| `npm run pack:mac` | Build a DMG into `release/` |

## Configuration

| Setting | Default | Notes |
|---|---|---|
| Hotkey | `Ctrl+Alt+Space` | `Ctrl+Space` is deliberately blocked — it collides with IME switching and IDE autocomplete |
| Model | `claude-haiku-4-5` | Sonnet 5 and Opus 5 selectable; Haiku is the default because this interaction lives or dies on latency |
| Instant mode | off | Skip the button and rewrite immediately on hotkey |
| Predictive prefetch | on | Start the rewrite while you reach for the button |

## Status

**v1 works end to end.** Selection capture is via clipboard round-trip, which works in
essentially every app but anchors the button to your mouse cursor rather than to the text.

**v2** adds an accessibility sidecar (UI Automation on Windows, `AXUIElement` on macOS) for
exact selection bounds and no clipboard side effects. The strategy interface in
[`src/main/selection/index.ts`](src/main/selection/index.ts) already has the hook.

The Pro tier needs a backend before it does anything — see `PRO_ENDPOINT` in
[`src/main/ai/index.ts`](src/main/ai/index.ts).
