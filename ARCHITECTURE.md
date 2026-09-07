# Sendrite — Architecture

> Rewrite any text, in any app, without leaving the window.

## The one-liner

Sendrite is a tray-resident desktop app that rewrites highlighted text in **any**
application. It reads your selection through the OS, sends it to Claude, and pastes
the result back over the original text.

## Four boxes, one job each

| Box | Where | Its one job |
|---|---|---|
| **Main process** | `src/main` | The brain. Global hotkey, orchestration, Claude calls. |
| **Native bridge** | `src/main/native` | The hands. Synthetic keystrokes into other apps. |
| **Renderers** | `src/renderer` | The face. The floating button, and welcome/settings. |
| **Backend** *(not built yet)* | Cloudflare Worker | The wallet. Holds the real API key for Pro users. |

## The flow

`src/main/rewrite.ts` is the file to read first — it is this list in code.

1. User highlights text in Slack and presses `Ctrl+Alt+Space`
2. `hotkey.ts` fires → `rewrite.ts#onHotkey`
3. `selection/` captures the highlighted text
4. `windows/button.ts` positions and shows the floating pill — **without taking focus**
5. *(in parallel)* a speculative Claude call starts, so the answer is usually ready on click
6. User clicks **Rewrite**, or picks a style from the menu
7. `ai/` returns the rewritten text
8. Button hides, then `selection/` pastes over the still-live selection

## The three decisions that matter

### 1. The button must never take focus

`focusable: false` in [`src/main/windows/button.ts`](src/main/windows/button.ts) is the
single most load-bearing line in the project. If the overlay took keyboard focus, the
source app would deactivate, lose its selection, and the paste would land nowhere.
Electron maps this to `WS_EX_NOACTIVATE` on Windows; macOS additionally needs
`type: 'panel'` for a non-activating NSPanel.

The window is also **created at boot and reused**. Creating a `BrowserWindow` on demand
costs 200–500ms — fatal for a hotkey interaction. Showing a warm one costs ~20ms.

### 2. Selection capture is a swappable strategy

[`src/main/selection/index.ts`](src/main/selection/index.ts) is an interface with one
implementation today and a hook for the second:

- **v1 — clipboard** (shipping). Simulate `Ctrl+C`, read the clipboard, restore it.
  Works in essentially every app. Costs: briefly borrows the clipboard, and cannot tell
  us *where* the selection is, so the button anchors to the mouse cursor.
- **v2 — accessibility** (planned). UI Automation on Windows, `AXUIElement` on macOS,
  running in a **sidecar process**. Returns the selection's real bounding rectangle, so
  the button sits exactly at the end of the highlighted text, and never touches the
  clipboard.

The sidecar lives out-of-process deliberately: UI Automation is COM, which is painful
through FFI and would otherwise mean a C++ N-API addon — node-gyp, ABI coupling to every
Electron release, and a prebuild matrix. A separate binary avoids all of it, and a crash
there doesn't take down the app.

### 3. No native compilation

The only OS calls v1 needs are synthetic keystrokes, and both platforms expose those as
*flat C APIs* (`user32!keybd_event`, `ApplicationServices!CGEventPost`). `koffi` calls
them using prebuilt binaries — no compiler, no node-gyp. See
[`src/main/native/keyboard.ts`](src/main/native/keyboard.ts).

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`, everything through the
  [preload allowlist](src/preload/index.ts).
- The API key is encrypted at rest with Electron `safeStorage` — DPAPI on Windows,
  Keychain on macOS. **The renderer has no way to read it back out**; there is
  deliberately no `getApiKey` on the bridge.
- Pro users have no key on their machine at all. A key shipped inside a desktop binary
  is a key you have given away.
- CSP on both renderer entry points; external links go to the system browser.

## Performance notes

The model call is ~90% of the wall clock; everything else is noise against it.

| Step | Budget |
|---|---|
| Hotkey → button visible | 30–190ms |
| **Claude call** | **400–1500ms** |
| Paste | 5–20ms |

Two mitigations: **speculative prefetch** (start the call on hotkey, before the click —
costs ~$0.001 for abandoned rewrites) and **Haiku 4.5 as the default model**, since a
40-word rewrite does not need a frontier model and this interaction lives or dies on
latency. Sonnet 5 and Opus 5 are selectable and run at `effort: 'low'` to keep adaptive
thinking from adding seconds.

## Known limitations (v1)

- Button anchors to the cursor, not the text (fixed by the v2 sidecar).
- Clipboard round-trip preserves only the *text* flavour — an image on the clipboard is
  lost during a rewrite.
- If the user clicks into a different app while the button is up, the paste could land in
  the wrong place. Mitigated by a 10s auto-dismiss and Escape-to-cancel; properly fixed by
  watching foreground-window changes in the sidecar.
- No undo beyond the host app's own `Ctrl+Z` (which does work — a paste is one undo unit).

## Layout

```
src/
├─ main/                    the brain (Node)
│  ├─ index.ts              lifecycle, single-instance lock, tray
│  ├─ rewrite.ts            ← THE FLOW
│  ├─ hotkey.ts             global shortcut + scoped Escape
│  ├─ ipc.ts                every ipcMain handler
│  ├─ store.ts              settings JSON + safeStorage secrets
│  ├─ tray.ts
│  ├─ native/keyboard.ts    koffi → keybd_event / CGEventPost
│  ├─ selection/            capture strategies
│  ├─ ai/                   Anthropic client + prompts
│  └─ windows/              button overlay, settings window
├─ preload/index.ts         contextBridge allowlist
├─ renderer/
│  ├─ button.html           overlay entry
│  ├─ settings.html         settings entry
│  └─ src/{button,settings}
└─ shared/                  types + IPC channel names (imported by all layers)
```
