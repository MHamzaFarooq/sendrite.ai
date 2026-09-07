import React from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingButton } from './FloatingButton'
import '../styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FloatingButton />
  </React.StrictMode>
)
