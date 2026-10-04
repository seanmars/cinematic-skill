import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { LocaleProvider } from './locale'
import { StudioProvider } from './studio'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <StudioProvider>
        <App />
      </StudioProvider>
    </LocaleProvider>
  </StrictMode>,
)
