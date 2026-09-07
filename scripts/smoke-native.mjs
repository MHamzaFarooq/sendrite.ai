/**
 * Verifies the koffi bridge can load and resolve the OS symbols Sendrite needs.
 * Deliberately does NOT fire any keystrokes -- that would type into whatever
 * window happens to be focused.
 *
 *   node scripts/smoke-native.mjs
 */
import koffi from 'koffi'

const results = []
const check = (label, fn) => {
  try {
    fn()
    results.push(['ok', label, ''])
  } catch (err) {
    results.push(['FAIL', label, err.message])
  }
}

if (process.platform === 'win32') {
  let user32
  check('load user32.dll', () => {
    user32 = koffi.load('user32.dll')
  })
  check('resolve keybd_event', () =>
    user32.func(
      'void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)'
    )
  )
} else if (process.platform === 'darwin') {
  const PATH =
    '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
  let lib
  check('load ApplicationServices', () => {
    lib = koffi.load(PATH)
  })
  check('resolve CGEventCreateKeyboardEvent', () =>
    lib.func('void* CGEventCreateKeyboardEvent(void* source, uint16 virtualKey, bool keyDown)')
  )
  check('resolve CGEventSetFlags', () => lib.func('void CGEventSetFlags(void* event, uint64 flags)'))
  check('resolve CGEventPost', () => lib.func('void CGEventPost(uint32 tap, void* event)'))
  check('resolve CFRelease', () => lib.func('void CFRelease(void* cf)'))
  check('call AXIsProcessTrusted', () => {
    const trusted = lib.func('bool AXIsProcessTrusted(void)')()
    results.push([
      trusted ? 'ok' : 'warn',
      'Accessibility permission',
      trusted ? '' : 'not granted yet — grant it in System Settings'
    ])
  })
} else {
  results.push(['FAIL', 'platform', `${process.platform} is not supported`])
}

let failed = false
console.log(`\nkoffi native smoke test — ${process.platform}/${process.arch}\n`)
for (const [status, label, note] of results) {
  if (status === 'FAIL') failed = true
  const mark = status === 'ok' ? '  ✓' : status === 'warn' ? '  !' : '  ✗'
  console.log(`${mark} ${label}${note ? `  — ${note}` : ''}`)
}
console.log(failed ? '\nNative bridge is NOT working.\n' : '\nNative bridge is ready.\n')
process.exit(failed ? 1 : 0)
