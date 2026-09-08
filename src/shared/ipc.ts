/**
 * Every IPC channel name in one place, so main and preload can never drift.
 */
export const IPC = {
  // renderer -> main (invoke)
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  getPermissions: 'permissions:get',
  requestAccessibility: 'permissions:request-accessibility',
  validateApiKey: 'key:validate',
  hasApiKey: 'key:has',
  clearApiKey: 'key:clear',
  runRewrite: 'rewrite:run',
  dismissButton: 'button:dismiss',
  resizeButton: 'button:resize',
  closeSettings: 'settings:close',

  // main -> renderer (send)
  buttonState: 'button:state'
} as const
