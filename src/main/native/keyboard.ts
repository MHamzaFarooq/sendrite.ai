/**
 * Synthetic keystrokes aimed at whatever app currently has focus.
 *
 * Electron's `webContents.sendInputEvent` only reaches our own windows, so
 * copy/paste into a third-party app has to go through the OS. Both platforms
 * expose this as a *flat* C API, which means koffi can call it with its
 * prebuilt binaries -- no node-gyp, no C++ toolchain, no per-Electron rebuild.
 *
 *   Windows  user32!keybd_event
 *   macOS    ApplicationServices!CGEventCreateKeyboardEvent + CGEventPost
 *
 * If this file ever needs more than keystrokes (reading a selection's
 * bounding rect, for instance) that work belongs in a sidecar process rather
 * than here -- UI Automation is COM and is genuinely painful through FFI.
 */
import koffi from 'koffi'

type Combo = 'copy' | 'paste'

interface KeyboardBackend {
  send(combo: Combo): void
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

const VK_CONTROL = 0x11
const VK_C = 0x43
const VK_V = 0x56
const KEYEVENTF_KEYUP = 0x0002

function createWindowsBackend(): KeyboardBackend {
  const user32 = koffi.load('user32.dll')
  // void keybd_event(BYTE bVk, BYTE bScan, DWORD dwFlags, ULONG_PTR dwExtraInfo)
  const keybd_event = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)')

  const tap = (vk: number): void => {
    keybd_event(vk, 0, 0, 0)
    keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
  }

  return {
    send(combo) {
      const key = combo === 'copy' ? VK_C : VK_V
      keybd_event(VK_CONTROL, 0, 0, 0)
      tap(key)
      keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
    }
  }
}

/* ------------------------------------------------------------------ */
/* macOS                                                               */
/* ------------------------------------------------------------------ */

const kVK_ANSI_C = 8
const kVK_ANSI_V = 9
const kCGEventFlagMaskCommand = 0x00100000
const kCGHIDEventTap = 0

const APPLICATION_SERVICES =
  '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'

function createMacBackend(): KeyboardBackend {
  const lib = koffi.load(APPLICATION_SERVICES)

  const CGEventCreateKeyboardEvent = lib.func(
    'void* CGEventCreateKeyboardEvent(void* source, uint16 virtualKey, bool keyDown)'
  )
  const CGEventSetFlags = lib.func('void CGEventSetFlags(void* event, uint64 flags)')
  const CGEventPost = lib.func('void CGEventPost(uint32 tap, void* event)')
  const CFRelease = lib.func('void CFRelease(void* cf)')

  const post = (key: number, down: boolean): void => {
    const ev = CGEventCreateKeyboardEvent(null, key, down)
    if (!ev) return
    CGEventSetFlags(ev, kCGEventFlagMaskCommand)
    CGEventPost(kCGHIDEventTap, ev)
    CFRelease(ev)
  }

  return {
    send(combo) {
      const key = combo === 'copy' ? kVK_ANSI_C : kVK_ANSI_V
      post(key, true)
      post(key, false)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

let backend: KeyboardBackend | null = null
let loadError: Error | null = null

function getBackend(): KeyboardBackend | null {
  if (backend || loadError) return backend
  try {
    backend =
      process.platform === 'win32'
        ? createWindowsBackend()
        : process.platform === 'darwin'
          ? createMacBackend()
          : null
    if (!backend) loadError = new Error(`Unsupported platform: ${process.platform}`)
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err))
    console.error('[keyboard] failed to load native backend:', loadError.message)
  }
  return backend
}

/** True when synthetic keystrokes are available on this machine. */
export function isKeyboardAvailable(): boolean {
  return getBackend() !== null
}

export function sendCopy(): void {
  getBackend()?.send('copy')
}

export function sendPaste(): void {
  getBackend()?.send('paste')
}

/**
 * macOS gates synthetic events and accessibility reads behind the same
 * Accessibility permission. Windows has no equivalent gate.
 */
export function isAccessibilityTrusted(): boolean {
  if (process.platform !== 'darwin') return true
  try {
    const lib = koffi.load(APPLICATION_SERVICES)
    const AXIsProcessTrusted = lib.func('bool AXIsProcessTrusted(void)')
    return Boolean(AXIsProcessTrusted())
  } catch (err) {
    console.error('[keyboard] AXIsProcessTrusted failed:', err)
    return false
  }
}
