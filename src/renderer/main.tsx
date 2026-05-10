import React from 'react'
import { createRoot } from 'react-dom/client'
import { IndicatorApp } from './IndicatorApp'
import { SettingsApp } from './settings/SettingsApp'
import './styles/globals.css'

const params = new URLSearchParams(window.location.search)
const page = params.get('page')

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing')

const Root = page === 'settings' ? SettingsApp : IndicatorApp

if (page === 'settings') {
  document.body.classList.remove('bg-transparent')
  document.body.classList.add('bg-zinc-950', 'text-zinc-100')
}

createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
