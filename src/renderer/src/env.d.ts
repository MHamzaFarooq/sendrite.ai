/// <reference types="vite/client" />

import type { SendriteApi } from '../../preload'

declare global {
  interface Window {
    sendrite: SendriteApi
  }
}

export {}
