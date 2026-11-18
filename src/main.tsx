import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { registerServiceWorker } from './lib/pwa'
import './index.css'
import '@fontsource-variable/plus-jakarta-sans'
import './theme.css'
import './vehicle-studio.css'
import './quote-actions.css'
import './auth-brand.css'
import './responsive.css'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>
)
