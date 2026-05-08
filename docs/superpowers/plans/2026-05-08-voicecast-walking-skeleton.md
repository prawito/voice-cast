# VoiceCast Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end macOS Electron app that, on `Cmd+Shift+V`, records mic audio, transcribes it locally with Whisper (Indonesian), and pastes the result into the focused application.

**Architecture:** Three-process Electron split — main (Node.js orchestration + Whisper + injection), preload (contextBridge), renderer (React indicator UI + Web Audio capture + WAV encode). Toggle-mode global hotkey, frameless transparent always-on-top indicator window, clipboard-paste injection via osascript.

**Tech Stack:** Electron 33, electron-vite 2.3, TypeScript 5.5, React 18.3, Tailwind 3.4, nodejs-whisper 0.2.

**Spec:** `docs/superpowers/specs/2026-05-08-voicecast-walking-skeleton-design.md`

**No automated test framework** in walking skeleton (per spec §8). Each task ends with a manual verification step. Frequent commits — one per task.

---

## Phase 0: Project Setup

### Task 1: Initialize project & git

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/package.json`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/.gitignore`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/.nvmrc`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/README.md`

- [ ] **Step 1: Initialize git in project root**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && git init
```

Expected: `Initialized empty Git repository in /Users/prawito/Documents/code/spt/voice-cast/.git/`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "voicecast",
  "version": "0.1.0",
  "description": "System-wide voice-to-text input for desktop (Indonesian-first, offline).",
  "private": true,
  "main": "out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "typecheck:main": "tsc --noEmit -p tsconfig.main.json",
    "typecheck:renderer": "tsc --noEmit -p tsconfig.renderer.json",
    "typecheck": "npm run typecheck:main && npm run typecheck:renderer"
  },
  "engines": {
    "node": ">=20"
  },
  "author": "Prawito (PT Star Perkasa Technology)",
  "license": "UNLICENSED"
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
out/
dist/
.DS_Store
*.log
.env
.env.*
!.env.example
.cache/
.vite/
.turbo/
coverage/
.idea/
.vscode/
!.vscode/extensions.json
*.tsbuildinfo

# Whisper model cache
.nodejs-whisper/
models/

# OS
Thumbs.db

# Temporary
tmp/
*.swp
```

- [ ] **Step 4: Create `.nvmrc`**

```
20
```

- [ ] **Step 5: Create `README.md` skeleton (will fill in last task)**

```markdown
# VoiceCast

System-wide voice-to-text input for desktop. Indonesian-first, offline, privacy-preserving.

> Walking skeleton — see `docs/superpowers/specs/2026-05-08-voicecast-walking-skeleton-design.md` for scope.

## Setup

(To be filled in Task 22.)
```

- [ ] **Step 6: First commit**

```bash
git add package.json .gitignore .nvmrc README.md docs/
git commit -m "chore: initial project scaffold"
```

Expected: commit succeeds with files staged.

---

### Task 2: Install dependencies

**Files:**
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/package.json` (npm will update)
- Create: `/Users/prawito/Documents/code/spt/voice-cast/package-lock.json` (npm will create)

- [ ] **Step 1: Install runtime dependencies**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm install \
  react@^18.3.1 \
  react-dom@^18.3.1 \
  lucide-react@^0.468.0 \
  nodejs-whisper@^0.2.9
```

Expected: all packages resolve without errors. (May see peer-dep warnings — acceptable.)

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D \
  electron@^33.2.1 \
  electron-vite@^2.3.0 \
  vite@^5.4.11 \
  typescript@^5.6.3 \
  @types/node@^22.10.1 \
  @types/react@^18.3.12 \
  @types/react-dom@^18.3.1 \
  @vitejs/plugin-react@^4.3.4 \
  tailwindcss@^3.4.15 \
  postcss@^8.4.49 \
  autoprefixer@^10.4.20 \
  electron-builder@^25.1.8
```

Expected: install completes; `node_modules/` populated.

- [ ] **Step 3: Verify installs by listing top-level packages**

```bash
npm ls --depth=0
```

Expected: shows all packages above with no `UNMET DEPENDENCY` errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install electron + react + vite + tailwind + nodejs-whisper deps"
```

---

### Task 3: TypeScript configurations

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/tsconfig.json`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/tsconfig.base.json`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/tsconfig.main.json`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/tsconfig.renderer.json`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/tsconfig.preload.json`

- [ ] **Step 1: Create root `tsconfig.json` (project references)**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.main.json" },
    { "path": "./tsconfig.preload.json" },
    { "path": "./tsconfig.renderer.json" }
  ]
}
```

- [ ] **Step 2: Create `tsconfig.main.json` (main process: Node)**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node", "electron"],
    "outDir": "out/main",
    "rootDir": "src"
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 3: Create `tsconfig.preload.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "types": ["node", "electron"],
    "outDir": "out/preload",
    "rootDir": "src"
  },
  "include": ["src/preload/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 4: Create `tsconfig.renderer.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "outDir": "out/renderer",
    "rootDir": "src"
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 5: Create `tsconfig.base.json` (shared options)**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add tsconfig*.json
git commit -m "chore: add typescript project references for main/preload/renderer"
```

---

### Task 4: electron-vite + Tailwind config

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/electron.vite.config.ts`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/tailwind.config.js`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/postcss.config.js`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/index.html`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/styles/globals.css`

- [ ] **Step 1: Create `electron.vite.config.ts`**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  }
})
```

- [ ] **Step 2: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {}
  },
  plugins: []
}
```

- [ ] **Step 3: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 4: Create `src/renderer/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>VoiceCast</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob: mediastream:" />
    <link rel="stylesheet" href="./styles/globals.css" />
  </head>
  <body class="bg-transparent">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/renderer/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  background: transparent;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
  overflow: hidden;
}
```

- [ ] **Step 6: Commit**

```bash
git add electron.vite.config.ts tailwind.config.js postcss.config.js src/renderer/index.html src/renderer/styles/globals.css
git commit -m "chore: add electron-vite, tailwind, postcss config and index.html"
```

---

### Task 5: Shared types, constants & IPC channels

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/shared/types.ts`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/shared/constants.ts`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/ipc-channels.ts`

- [ ] **Step 1: Create `src/shared/types.ts`**

```ts
export type AppState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'injecting'
  | 'done'
  | 'clipboard-only'
  | 'error'

export interface StateUpdatePayload {
  state: AppState
  message?: string
}

export interface AudioSubmitPayload {
  buffer: ArrayBuffer
  durationMs: number
}

export interface AudioSubmitResult {
  ok: boolean
  text?: string
  error?: string
}

export type WindowVoiceCastApi = {
  onState: (cb: (payload: StateUpdatePayload) => void) => () => void
  onRecordingStart: (cb: () => void) => () => void
  onRecordingStop: (cb: () => void) => () => void
  submitAudio: (payload: AudioSubmitPayload) => Promise<AudioSubmitResult>
}

declare global {
  interface Window {
    voicecast: WindowVoiceCastApi
  }
}
```

- [ ] **Step 2: Create `src/shared/constants.ts`**

```ts
export const HOTKEY_TOGGLE = 'CommandOrControl+Shift+V'
export const TARGET_SAMPLE_RATE = 16000
export const WHISPER_MODEL_NAME = 'base'
export const WHISPER_LANGUAGE = 'id'
export const MAX_RECORDING_MS = 60_000
export const SILENCE_RMS_THRESHOLD = 0.003
export const INDICATOR_WIDTH = 220
export const INDICATOR_HEIGHT = 72
export const INDICATOR_MARGIN = 16
```

- [ ] **Step 3: Create `src/main/ipc-channels.ts`**

```ts
export const IPC = {
  STATE_UPDATE: 'voicecast:state-update',
  RECORDING_START: 'voicecast:recording-start',
  RECORDING_STOP: 'voicecast:recording-stop',
  AUDIO_SUBMIT: 'voicecast:audio-submit'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
```

- [ ] **Step 4: Verify typecheck (will fail because no main file yet — accept that)**

```bash
npx tsc --noEmit -p tsconfig.main.json
```

Expected: error TS18003 (no inputs found in tsconfig.main.json) is **acceptable** — we'll add the main entry next task. Type errors in the files we just wrote should be **zero**.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ src/main/ipc-channels.ts
git commit -m "feat: define shared types, constants, and IPC channel registry"
```

---

## Phase 1: Electron Skeleton Runs

### Task 6: Preload bridge

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/preload/index.ts`

- [ ] **Step 1: Create preload script**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc-channels'
import type {
  WindowVoiceCastApi,
  StateUpdatePayload,
  AudioSubmitPayload,
  AudioSubmitResult
} from '../shared/types'

const api: WindowVoiceCastApi = {
  onState(cb) {
    const listener = (_e: unknown, payload: StateUpdatePayload) => cb(payload)
    ipcRenderer.on(IPC.STATE_UPDATE, listener)
    return () => ipcRenderer.removeListener(IPC.STATE_UPDATE, listener)
  },
  onRecordingStart(cb) {
    const listener = () => cb()
    ipcRenderer.on(IPC.RECORDING_START, listener)
    return () => ipcRenderer.removeListener(IPC.RECORDING_START, listener)
  },
  onRecordingStop(cb) {
    const listener = () => cb()
    ipcRenderer.on(IPC.RECORDING_STOP, listener)
    return () => ipcRenderer.removeListener(IPC.RECORDING_STOP, listener)
  },
  submitAudio(payload: AudioSubmitPayload): Promise<AudioSubmitResult> {
    return ipcRenderer.invoke(IPC.AUDIO_SUBMIT, payload)
  }
}

contextBridge.exposeInMainWorld('voicecast', api)
```

- [ ] **Step 2: Verify file compiles in isolation**

```bash
npx tsc --noEmit -p tsconfig.preload.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: preload script exposing window.voicecast IPC bridge"
```

---

### Task 7: Main process entry + bootstrap (Electron starts)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/index.ts`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Create `src/main/index.ts`**

```ts
import { app } from 'electron'
import { bootstrap } from './bootstrap'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.dock?.hide()

  app.whenReady().then(() => {
    bootstrap().catch((err) => {
      console.error('[VoiceCast] bootstrap failed:', err)
      app.quit()
    })
  })

  app.on('window-all-closed', (event: Electron.Event) => {
    event.preventDefault()
  })

  app.on('will-quit', () => {
    // cleanup hook for future use
  })
}
```

- [ ] **Step 2: Create `src/main/bootstrap.ts` (minimal — just log "ready")**

```ts
export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')
  console.log('[VoiceCast] electron app ready')
  // wiring of managers added in later tasks
}
```

- [ ] **Step 3: Run dev server (first launch attempt)**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && timeout 8 npm run dev 2>&1 | head -50
```

Expected: electron-vite starts; you should see `[VoiceCast] bootstrap starting` and `electron app ready` in stdout. The app quits after timeout because no window is shown yet — that's OK for now.

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/bootstrap.ts
git commit -m "feat: main process entry with single-instance lock and bootstrap stub"
```

---

### Task 8: Renderer scaffold (hello indicator)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/main.tsx`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/App.tsx`

- [ ] **Step 1: Create `src/renderer/main.tsx`**

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing')
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Create minimal `src/renderer/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { AppState } from '../shared/types'

export function App() {
  const [state, setState] = useState<AppState>('idle')
  const [message, setMessage] = useState<string | undefined>()

  useEffect(() => {
    const off = window.voicecast?.onState(({ state: s, message: m }) => {
      setState(s)
      setMessage(m)
    })
    return () => off?.()
  }, [])

  return (
    <div className="flex h-[72px] w-[220px] items-center gap-3 rounded-2xl bg-neutral-900/90 px-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <div className="text-sm font-medium">VoiceCast</div>
      <div className="ml-auto text-xs text-neutral-300">{message ?? state}</div>
    </div>
  )
}
```

- [ ] **Step 3: Verify renderer typecheck**

```bash
npx tsc --noEmit -p tsconfig.renderer.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/main.tsx src/renderer/App.tsx
git commit -m "feat: renderer scaffold with App listening to state IPC"
```

---

### Task 9: Indicator window factory + show on bootstrap

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/indicator-window.ts`
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Create `src/main/indicator-window.ts`**

```ts
import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC } from './ipc-channels'
import type { StateUpdatePayload } from '../shared/types'
import {
  INDICATOR_HEIGHT,
  INDICATOR_MARGIN,
  INDICATOR_WIDTH
} from '../shared/constants'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export class IndicatorWindow {
  private win: BrowserWindow | null = null

  async create(): Promise<void> {
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    const x = workArea.x + workArea.width - INDICATOR_WIDTH - INDICATOR_MARGIN
    const y = workArea.y + workArea.height - INDICATOR_HEIGHT - INDICATOR_MARGIN

    this.win = new BrowserWindow({
      width: INDICATOR_WIDTH,
      height: INDICATOR_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: join(__dirname, '../preload/index.js')
      }
    })

    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (process.env.ELECTRON_RENDERER_URL) {
      await this.win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await this.win.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  show(): void {
    this.win?.showInactive()
  }

  hide(): void {
    this.win?.hide()
  }

  pushState(payload: StateUpdatePayload): void {
    this.win?.webContents.send(IPC.STATE_UPDATE, payload)
  }

  sendStart(): void {
    this.win?.webContents.send(IPC.RECORDING_START)
  }

  sendStop(): void {
    this.win?.webContents.send(IPC.RECORDING_STOP)
  }

  get webContents(): Electron.WebContents | undefined {
    return this.win?.webContents
  }

  destroy(): void {
    this.win?.destroy()
    this.win = null
  }
}
```

- [ ] **Step 2: Modify `src/main/bootstrap.ts` to create + show indicator**

Replace entire file:

```ts
import { IndicatorWindow } from './indicator-window'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()
  indicator.show()
  indicator.pushState({ state: 'idle', message: 'ready' })

  console.log('[VoiceCast] indicator window created and shown')
}
```

- [ ] **Step 3: Run dev and verify window appears**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

Expected: A small dark rounded indicator appears in the bottom-right of the primary display showing `VoiceCast | ready`. Press Ctrl+C in the terminal to quit.

- [ ] **Step 4: Commit**

```bash
git add src/main/indicator-window.ts src/main/bootstrap.ts
git commit -m "feat: frameless transparent always-on-top indicator window"
```

---

### Task 10: Tray icon (with quit menu) + placeholder icon

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/resources/iconTemplate.png` (16x16 placeholder)
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/tray.ts`
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Create placeholder tray icon**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && mkdir -p resources && /usr/bin/python3 -c "
import struct, zlib
def png_1x1_black():
    sig=b'\\x89PNG\\r\\n\\x1a\\n'
    def chunk(t,d):
        return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d) & 0xffffffff)
    ihdr=struct.pack('>IIBBBBB',16,16,8,4,0,0,0)
    raw=b''.join(b'\\x00'+b'\\xff'*16 for _ in range(16))
    idat=zlib.compress(raw)
    return sig+chunk(b'IHDR',ihdr)+chunk(b'IDAT',idat)+chunk(b'IEND',b'')
open('resources/iconTemplate.png','wb').write(png_1x1_black())
print('icon written')
"
```

Expected: `icon written`. (This is a 16x16 grayscale placeholder; replace with real art later.)

- [ ] **Step 2: Create `src/main/tray.ts`**

```ts
import { Menu, Tray, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export function createTray(onQuit: () => void): Tray {
  const iconPath = join(__dirname, '../../resources/iconTemplate.png')
  const image = nativeImage.createFromPath(iconPath)
  image.setTemplateImage(true)

  const tray = new Tray(image)
  tray.setToolTip('VoiceCast (idle)')

  const menu = Menu.buildFromTemplate([
    { label: 'VoiceCast — walking skeleton', enabled: false },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        onQuit()
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  return tray
}
```

- [ ] **Step 3: Modify `bootstrap.ts` to create tray**

Replace contents:

```ts
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()

  const tray = createTray(() => {
    indicator.destroy()
  })

  indicator.show()
  indicator.pushState({ state: 'idle', message: 'ready' })

  console.log('[VoiceCast] indicator window + tray created')
  return Promise.resolve(tray) as unknown as Promise<void>
}
```

(The `tray` reference is held by closure; the `return` cast prevents tree-shaking.)

- [ ] **Step 4: Run dev and verify tray icon**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

Expected: Indicator visible AND a tray icon (small black square placeholder) appears in the macOS menu bar. Right-click the tray icon → "Quit" exits the app cleanly.

- [ ] **Step 5: Commit**

```bash
git add resources/ src/main/tray.ts src/main/bootstrap.ts
git commit -m "feat: tray icon with quit menu"
```

---

## Phase 2: Audio Capture + Transcription

### Task 11: WAV encoder

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/audio/wav-encoder.ts`

- [ ] **Step 1: Create encoder**

```ts
import { TARGET_SAMPLE_RATE } from '../../shared/constants'

export interface EncodeInput {
  channels: Float32Array[]
  sourceSampleRate: number
}

export function encodeWav({ channels, sourceSampleRate }: EncodeInput): ArrayBuffer {
  const mono = downmixToMono(channels)
  const resampled =
    sourceSampleRate === TARGET_SAMPLE_RATE
      ? mono
      : resampleLinear(mono, sourceSampleRate, TARGET_SAMPLE_RATE)
  const pcm = floatTo16BitPCM(resampled)
  return buildWavBuffer(pcm, TARGET_SAMPLE_RATE)
}

function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const length = channels[0].length
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let c = 0; c < channels.length; c++) sum += channels[c][i]
    out[i] = sum / channels.length
  }
  return out
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio
    const i0 = Math.floor(srcIndex)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const frac = srcIndex - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function buildWavBuffer(pcm: Int16Array, sampleRate: number): ArrayBuffer {
  const byteLength = pcm.length * 2
  const buf = new ArrayBuffer(44 + byteLength)
  const view = new DataView(buf)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + byteLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, byteLength, true)

  let offset = 44
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true)
  }
  return buf
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

export function computeRMS(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / Math.max(samples.length, 1))
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.renderer.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/audio/wav-encoder.ts
git commit -m "feat: WAV 16-bit PCM mono 16kHz encoder + RMS helper"
```

---

### Task 12: Audio capture service (renderer)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/audio/audio-capture.ts`

- [ ] **Step 1: Create capture service**

```ts
import { encodeWav, computeRMS } from './wav-encoder'

export interface CaptureResult {
  wav: ArrayBuffer
  durationMs: number
  rms: number
}

export class AudioCapture {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private buffersByChannel: Float32Array[][] = []
  private totalSamples = 0
  private startTime = 0
  private capturing = false

  async start(): Promise<void> {
    if (this.capturing) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })
    this.context = new AudioContext()
    this.source = this.context.createMediaStreamSource(this.stream)
    const bufferSize = 4096
    const channelCount = this.source.channelCount || 1
    this.processor = this.context.createScriptProcessor(bufferSize, channelCount, channelCount)
    this.buffersByChannel = Array.from({ length: channelCount }, () => [])
    this.totalSamples = 0

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer
      for (let c = 0; c < input.numberOfChannels; c++) {
        const data = input.getChannelData(c)
        this.buffersByChannel[c].push(new Float32Array(data))
      }
      this.totalSamples += input.length
    }

    this.source.connect(this.processor)
    this.processor.connect(this.context.destination)
    this.startTime = performance.now()
    this.capturing = true
  }

  async stop(): Promise<CaptureResult | null> {
    if (!this.capturing) return null
    this.capturing = false
    const durationMs = performance.now() - this.startTime

    this.processor?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    const sourceSampleRate = this.context?.sampleRate ?? 48000
    await this.context?.close()

    const channels: Float32Array[] = this.buffersByChannel.map((chunks) =>
      flatten(chunks, this.totalSamples)
    )

    this.context = null
    this.source = null
    this.processor = null
    this.stream = null

    if (channels.length === 0 || channels[0].length === 0) return null

    const wav = encodeWav({ channels, sourceSampleRate })
    const rms = computeRMS(channels[0])

    return { wav, durationMs, rms }
  }
}

function flatten(chunks: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.renderer.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/audio/audio-capture.ts
git commit -m "feat: AudioCapture service (getUserMedia + ScriptProcessor)"
```

---

### Task 13: Wire renderer to capture and submit on stop

**Files:**
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/App.tsx`

- [ ] **Step 1: Replace `App.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../shared/types'
import { AudioCapture } from './audio/audio-capture'
import { SILENCE_RMS_THRESHOLD } from '../shared/constants'

export function App() {
  const [state, setState] = useState<AppState>('idle')
  const [message, setMessage] = useState<string | undefined>('ready')
  const captureRef = useRef<AudioCapture | null>(null)

  useEffect(() => {
    const offState = window.voicecast.onState(({ state: s, message: m }) => {
      setState(s)
      setMessage(m)
    })

    const offStart = window.voicecast.onRecordingStart(async () => {
      try {
        const capture = new AudioCapture()
        captureRef.current = capture
        await capture.start()
      } catch (err) {
        console.error('[VoiceCast] mic error', err)
      }
    })

    const offStop = window.voicecast.onRecordingStop(async () => {
      const capture = captureRef.current
      captureRef.current = null
      if (!capture) return
      const result = await capture.stop()
      if (!result) {
        await window.voicecast.submitAudio({
          buffer: new ArrayBuffer(0),
          durationMs: 0
        })
        return
      }
      if (result.rms < SILENCE_RMS_THRESHOLD) {
        console.warn('[VoiceCast] silence detected, RMS=', result.rms)
      }
      await window.voicecast.submitAudio({
        buffer: result.wav,
        durationMs: result.durationMs
      })
    })

    return () => {
      offState()
      offStart()
      offStop()
    }
  }, [])

  return (
    <div className="flex h-[72px] w-[220px] items-center gap-3 rounded-2xl bg-neutral-900/90 px-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <StateBadge state={state} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">VoiceCast</span>
        <span className="text-[11px] text-neutral-300">{message ?? state}</span>
      </div>
    </div>
  )
}

function StateBadge({ state }: { state: AppState }) {
  const color =
    state === 'recording'
      ? 'bg-red-500'
      : state === 'transcribing'
        ? 'bg-amber-400'
        : state === 'injecting'
          ? 'bg-sky-400'
          : state === 'done'
            ? 'bg-emerald-400'
            : state === 'error'
              ? 'bg-rose-500'
              : 'bg-neutral-500'
  return <span className={`h-3 w-3 rounded-full ${color}`} />
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.renderer.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: renderer wires recording-start/stop to AudioCapture and submits WAV"
```

---

### Task 14: Transcription service (main, nodejs-whisper)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/transcription-service.ts`

- [ ] **Step 1: Create service**

```ts
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { WHISPER_LANGUAGE, WHISPER_MODEL_NAME } from '../shared/constants'

export class TranscriptionService {
  async transcribe(wav: ArrayBuffer): Promise<string> {
    if (wav.byteLength === 0) {
      throw new Error('Empty audio buffer')
    }

    const tmpFile = join(tmpdir(), `voicecast-${randomUUID()}.wav`)
    await fs.writeFile(tmpFile, Buffer.from(wav))

    try {
      const { nodewhisper } = await import('nodejs-whisper')
      const result = await nodewhisper(tmpFile, {
        modelName: WHISPER_MODEL_NAME,
        autoDownloadModelName: WHISPER_MODEL_NAME,
        verbose: false,
        removeWavFileAfterTranscription: false,
        whisperOptions: {
          language: WHISPER_LANGUAGE,
          outputInText: true,
          outputInJson: false,
          outputInSrt: false,
          outputInVtt: false,
          translateToEnglish: false,
          wordTimestamps: false,
          timestamps_length: 0,
          splitOnWord: false
        } as Record<string, unknown>
      } as Record<string, unknown>)

      const text = typeof result === 'string' ? result : ''
      return cleanWhisperOutput(text)
    } finally {
      await fs.unlink(tmpFile).catch(() => {})
      // nodejs-whisper writes <name>.wav.txt next to the input — clean it too
      await fs.unlink(`${tmpFile}.txt`).catch(() => {})
    }
  }
}

function cleanWhisperOutput(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, ''))
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}
```

> **Note:** `nodejs-whisper`'s exact return shape differs across versions. We dynamic-import to load it lazily (saves cold start) and treat the result defensively (string or object). The `cleanWhisperOutput` helper strips the `[hh:mm:ss.mmm --> ...]` timestamp prefixes whisper.cpp emits by default.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.main.json
```

Expected: no errors. (If it complains about nodejs-whisper types, they ship `.d.ts` so it should be clean. If types are missing, a `// @ts-expect-error` line at the import is acceptable.)

- [ ] **Step 3: Commit**

```bash
git add src/main/transcription-service.ts
git commit -m "feat: TranscriptionService wrapping nodejs-whisper with tmpfile lifecycle"
```

---

### Task 15: IPC handler for audio:submit + standalone smoke test

**Files:**
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Modify `bootstrap.ts` to register IPC handler**

```ts
import { ipcMain } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { IPC } from './ipc-channels'
import type { AudioSubmitPayload, AudioSubmitResult } from '../shared/types'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()
  const tray = createTray(() => indicator.destroy())
  void tray

  const transcription = new TranscriptionService()

  ipcMain.handle(
    IPC.AUDIO_SUBMIT,
    async (_event, payload: AudioSubmitPayload): Promise<AudioSubmitResult> => {
      console.log(
        `[VoiceCast] audio submitted: ${payload.buffer.byteLength} bytes, ${payload.durationMs.toFixed(0)} ms`
      )
      indicator.pushState({ state: 'transcribing', message: 'transcribing…' })
      try {
        const text = await transcription.transcribe(payload.buffer)
        console.log('[VoiceCast] transcript:', JSON.stringify(text))
        indicator.pushState({ state: 'idle', message: text || 'no text' })
        return { ok: true, text }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[VoiceCast] transcription error:', message)
        indicator.pushState({ state: 'error', message: 'transcription failed' })
        return { ok: false, error: message }
      }
    }
  )

  indicator.show()
  indicator.pushState({ state: 'idle', message: 'ready' })

  // Dev affordance: start a recording 1s after launch and stop after 5s
  // for a smoke test. Disabled here; controlled by hotkey in next task.

  console.log('[VoiceCast] bootstrap complete (no hotkey wired yet)')
}
```

- [ ] **Step 2: Create temporary smoke-test trigger**

For verifying the audio→transcription round trip *before* the hotkey exists, we'll temporarily auto-trigger from the renderer.

Modify `src/renderer/App.tsx` — append at end of the `useEffect` body, just before `return`:

```tsx
    // === SMOKE TEST: remove in Task 17 ===
    const smokeTimer = window.setTimeout(async () => {
      console.log('[smoke] auto-start recording')
      const capture = new AudioCapture()
      captureRef.current = capture
      await capture.start()
      window.setTimeout(async () => {
        console.log('[smoke] auto-stop recording')
        const result = await capture.stop()
        captureRef.current = null
        if (result) {
          const res = await window.voicecast.submitAudio({
            buffer: result.wav,
            durationMs: result.durationMs
          })
          console.log('[smoke] result', res)
        }
      }, 5000)
    }, 2000)
    // === END SMOKE TEST ===
```

And in the cleanup return, add `window.clearTimeout(smokeTimer)` before the existing offState calls.

- [ ] **Step 3: Run dev and speak for the 5-second auto-record**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

When you see `[smoke] auto-start recording` in the console (~2s after launch), say something in Indonesian like "halo, ini tes transkripsi". After ~5s the renderer auto-stops and submits.

Expected console output (sample):
```
[VoiceCast] audio submitted: 320044 bytes, 5012 ms
[ffmpeg / nodejs-whisper download progress lines on first run]
[VoiceCast] transcript: "halo, ini tes transkripsi"
```

The first run will download the `base` model (~145 MB) — be patient. The indicator window's right-side text will show the transcript.

- [ ] **Step 4: Remove smoke test snippet**

Edit `src/renderer/App.tsx` and delete the block between `=== SMOKE TEST` and `=== END SMOKE TEST ===` plus the `clearTimeout` line.

- [ ] **Step 5: Commit**

```bash
git add src/main/bootstrap.ts src/renderer/App.tsx
git commit -m "feat: IPC audio:submit handler runs whisper transcription end-to-end"
```

---

## Phase 3: Hotkey + Injection

### Task 16: Recording controller state machine

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/recording-controller.ts`

- [ ] **Step 1: Create controller**

```ts
import { EventEmitter } from 'node:events'
import type { AppState } from '../shared/types'

type ControllerEvents = {
  state: [AppState, string | undefined]
  startRecording: []
  stopRecording: []
}

export class RecordingController extends EventEmitter<ControllerEvents> {
  private current: AppState = 'idle'

  state(): AppState {
    return this.current
  }

  toggle(): void {
    if (this.current === 'idle') {
      this.transition('recording', 'listening')
      this.emit('startRecording')
      return
    }
    if (this.current === 'recording') {
      this.transition('transcribing', 'transcribing…')
      this.emit('stopRecording')
      return
    }
    // ignore toggles during transcribing/injecting/done
  }

  setTranscribing(): void {
    this.transition('transcribing', 'transcribing…')
  }

  setInjecting(): void {
    this.transition('injecting', 'pasting…')
  }

  setDone(text: string): void {
    const preview = text.length > 30 ? `${text.slice(0, 30)}…` : text
    this.transition('done', preview || 'done')
  }

  setClipboardOnly(text: string): void {
    const preview = text.length > 30 ? `${text.slice(0, 30)}…` : text
    this.transition('clipboard-only', `clipboard: ${preview}`)
  }

  setError(message: string): void {
    this.transition('error', message)
  }

  reset(): void {
    this.transition('idle', 'ready')
  }

  private transition(state: AppState, message?: string): void {
    this.current = state
    this.emit('state', state, message)
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.main.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/recording-controller.ts
git commit -m "feat: RecordingController state machine with EventEmitter"
```

---

### Task 17: Hotkey manager + bootstrap rewire

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/hotkey-manager.ts`
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Create hotkey manager**

```ts
import { globalShortcut } from 'electron'
import { HOTKEY_TOGGLE } from '../shared/constants'

export class HotkeyManager {
  registerToggle(callback: () => void): boolean {
    const ok = globalShortcut.register(HOTKEY_TOGGLE, callback)
    if (!ok) {
      console.error(`[VoiceCast] failed to register hotkey ${HOTKEY_TOGGLE} (conflict?)`)
    } else {
      console.log(`[VoiceCast] hotkey registered: ${HOTKEY_TOGGLE}`)
    }
    return ok
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
```

- [ ] **Step 2: Modify `bootstrap.ts` — wire controller, hotkey, and indicator state**

Replace entire file:

```ts
import { app, ipcMain } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { HotkeyManager } from './hotkey-manager'
import { RecordingController } from './recording-controller'
import { IPC } from './ipc-channels'
import { MAX_RECORDING_MS } from '../shared/constants'
import type { AudioSubmitPayload, AudioSubmitResult } from '../shared/types'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const indicator = new IndicatorWindow()
  await indicator.create()
  const tray = createTray(() => {
    indicator.destroy()
  })
  void tray

  const controller = new RecordingController()
  const hotkey = new HotkeyManager()
  const transcription = new TranscriptionService()

  let recordingTimer: NodeJS.Timeout | null = null

  controller.on('state', (state, message) => {
    indicator.pushState({ state, message })
  })

  controller.on('startRecording', () => {
    indicator.show()
    indicator.sendStart()
    if (recordingTimer) clearTimeout(recordingTimer)
    recordingTimer = setTimeout(() => {
      console.warn('[VoiceCast] max recording duration reached, auto-stopping')
      controller.toggle()
    }, MAX_RECORDING_MS)
  })

  controller.on('stopRecording', () => {
    if (recordingTimer) {
      clearTimeout(recordingTimer)
      recordingTimer = null
    }
    indicator.sendStop()
  })

  ipcMain.handle(
    IPC.AUDIO_SUBMIT,
    async (_e, payload: AudioSubmitPayload): Promise<AudioSubmitResult> => {
      console.log(
        `[VoiceCast] audio submitted: ${payload.buffer.byteLength} bytes, ${payload.durationMs.toFixed(0)} ms`
      )
      try {
        const text = await transcription.transcribe(payload.buffer)
        if (!text) {
          controller.setError('no text recognized')
          fadeIdle(controller, indicator, 1500)
          return { ok: true, text: '' }
        }
        // injection happens in next task — for now just preview
        controller.setDone(text)
        fadeIdle(controller, indicator, 1000)
        return { ok: true, text }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[VoiceCast] transcription error:', message)
        controller.setError('transcription failed')
        fadeIdle(controller, indicator, 1500)
        return { ok: false, error: message }
      }
    }
  )

  hotkey.registerToggle(() => controller.toggle())

  app.on('will-quit', () => hotkey.unregisterAll())

  indicator.show()
  controller.reset()
  console.log('[VoiceCast] bootstrap complete; press Cmd+Shift+V')
}

function fadeIdle(controller: RecordingController, indicator: IndicatorWindow, delayMs: number) {
  setTimeout(() => {
    controller.reset()
    indicator.hide()
  }, delayMs)
}
```

- [ ] **Step 3: Run dev — hotkey-driven flow**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

Switch to a text editor (TextEdit, VS Code, etc). Press `Cmd+Shift+V` — indicator should appear with red dot. Speak in Indonesian. Press `Cmd+Shift+V` again. The indicator should show transcribing → done with the transcript preview, then fade out. **Note:** text is *not* yet pasted — that's the next task.

Expected console output:
```
[VoiceCast] hotkey registered: CommandOrControl+Shift+V
[VoiceCast] audio submitted: ...bytes, ... ms
[VoiceCast] transcript: "..."
```

If hotkey registration fails (`failed to register hotkey ... (conflict?)`), check that no other app uses `Cmd+Shift+V` (some clipboard managers do).

- [ ] **Step 4: Commit**

```bash
git add src/main/hotkey-manager.ts src/main/bootstrap.ts
git commit -m "feat: global hotkey + RecordingController wired through bootstrap"
```

---

### Task 18: Permissions detection (macOS Accessibility)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/permissions.ts`
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Create permissions module**

```ts
import { systemPreferences } from 'electron'

export interface PermissionStatus {
  accessibilityTrusted: boolean
  microphone: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'
}

export function checkPermissions(): PermissionStatus {
  if (process.platform !== 'darwin') {
    return { accessibilityTrusted: true, microphone: 'unknown' }
  }
  const accessibilityTrusted = systemPreferences.isTrustedAccessibilityClient(false)
  const micStatus = systemPreferences.getMediaAccessStatus('microphone')
  return { accessibilityTrusted, microphone: micStatus }
}

export function logPermissionGuidance(status: PermissionStatus): void {
  console.log('[VoiceCast] permissions:', status)
  if (!status.accessibilityTrusted) {
    console.warn(
      '\n[VoiceCast] Accessibility permission NOT granted.\n' +
        '  Paste injection (Cmd+V to other apps) will fail.\n' +
        '  Open: System Settings -> Privacy & Security -> Accessibility\n' +
        '  Enable: Electron (or VoiceCast when packaged).\n' +
        '  Restart this app after granting.\n'
    )
  }
  if (status.microphone === 'denied') {
    console.warn(
      '\n[VoiceCast] Microphone permission denied.\n' +
        '  Open: System Settings -> Privacy & Security -> Microphone\n' +
        '  Enable: Electron / VoiceCast.\n'
    )
  }
}
```

- [ ] **Step 2: Modify `bootstrap.ts` — check permissions at startup**

Add at the top of `bootstrap()` after `console.log('[VoiceCast] bootstrap starting')`:

```ts
  const permissions = checkPermissions()
  logPermissionGuidance(permissions)
```

Add the import at the top of the file:

```ts
import { checkPermissions, logPermissionGuidance } from './permissions'
```

- [ ] **Step 3: Run dev and verify console output**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && timeout 5 npm run dev 2>&1 | grep -A2 -i 'permission\|accessibility'
```

Expected: One of:
- `[VoiceCast] permissions: { accessibilityTrusted: true, microphone: 'granted' }` (if already granted)
- `[VoiceCast] Accessibility permission NOT granted.` (with instructions)

- [ ] **Step 4: Commit**

```bash
git add src/main/permissions.ts src/main/bootstrap.ts
git commit -m "feat: detect mic + accessibility permissions and surface guidance"
```

---

### Task 19: Injection service (clipboard + osascript Cmd+V)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/main/injection-service.ts`

- [ ] **Step 1: Create service**

```ts
import { clipboard } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface InjectionResult {
  ok: boolean
  pasted: boolean
  error?: string
}

export class InjectionService {
  async inject(text: string): Promise<InjectionResult> {
    try {
      clipboard.writeText(text)
    } catch (err) {
      return {
        ok: false,
        pasted: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }

    if (process.platform !== 'darwin') {
      return { ok: true, pasted: false, error: 'paste only implemented on macOS' }
    }

    try {
      await execFileAsync('osascript', [
        '-e',
        'tell application "System Events" to keystroke "v" using command down'
      ])
      return { ok: true, pasted: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: true, pasted: false, error: message }
    }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.main.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/injection-service.ts
git commit -m "feat: InjectionService writes clipboard and pastes via osascript execFile"
```

---

### Task 20: End-to-end wiring (transcription → injection → fade)

**Files:**
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/main/bootstrap.ts`

- [ ] **Step 1: Replace bootstrap with full pipeline**

```ts
import { app, ipcMain } from 'electron'
import { IndicatorWindow } from './indicator-window'
import { createTray } from './tray'
import { TranscriptionService } from './transcription-service'
import { InjectionService } from './injection-service'
import { HotkeyManager } from './hotkey-manager'
import { RecordingController } from './recording-controller'
import { checkPermissions, logPermissionGuidance } from './permissions'
import { IPC } from './ipc-channels'
import { MAX_RECORDING_MS } from '../shared/constants'
import type { AudioSubmitPayload, AudioSubmitResult } from '../shared/types'

export async function bootstrap(): Promise<void> {
  console.log('[VoiceCast] bootstrap starting')

  const permissions = checkPermissions()
  logPermissionGuidance(permissions)

  const indicator = new IndicatorWindow()
  await indicator.create()
  const tray = createTray(() => indicator.destroy())
  void tray

  const controller = new RecordingController()
  const hotkey = new HotkeyManager()
  const transcription = new TranscriptionService()
  const injection = new InjectionService()

  let recordingTimer: NodeJS.Timeout | null = null

  controller.on('state', (state, message) => {
    indicator.pushState({ state, message })
  })

  controller.on('startRecording', () => {
    indicator.show()
    indicator.sendStart()
    if (recordingTimer) clearTimeout(recordingTimer)
    recordingTimer = setTimeout(() => {
      console.warn('[VoiceCast] max recording duration reached, auto-stopping')
      controller.toggle()
    }, MAX_RECORDING_MS)
  })

  controller.on('stopRecording', () => {
    if (recordingTimer) {
      clearTimeout(recordingTimer)
      recordingTimer = null
    }
    indicator.sendStop()
  })

  ipcMain.handle(
    IPC.AUDIO_SUBMIT,
    async (_e, payload: AudioSubmitPayload): Promise<AudioSubmitResult> => {
      console.log(
        `[VoiceCast] audio submitted: ${payload.buffer.byteLength} bytes, ${payload.durationMs.toFixed(0)} ms`
      )

      if (payload.buffer.byteLength === 0) {
        controller.setError('no audio captured')
        scheduleIdle(controller, indicator, 1500)
        return { ok: true, text: '' }
      }

      let text: string
      try {
        text = await transcription.transcribe(payload.buffer)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[VoiceCast] transcription error:', message)
        controller.setError('transcription failed')
        scheduleIdle(controller, indicator, 1500)
        return { ok: false, error: message }
      }

      if (!text.trim()) {
        controller.setError('no text recognized')
        scheduleIdle(controller, indicator, 1500)
        return { ok: true, text: '' }
      }

      controller.setInjecting()
      const result = await injection.inject(text)
      if (result.pasted) {
        controller.setDone(text)
        scheduleIdle(controller, indicator, 1000)
      } else {
        controller.setClipboardOnly(text)
        if (result.error) console.warn('[VoiceCast] paste fallback:', result.error)
        scheduleIdle(controller, indicator, 2000)
      }
      return { ok: true, text }
    }
  )

  hotkey.registerToggle(() => controller.toggle())
  app.on('will-quit', () => hotkey.unregisterAll())

  controller.reset()
  console.log('[VoiceCast] ready — press Cmd+Shift+V to dictate')
}

function scheduleIdle(
  controller: RecordingController,
  indicator: IndicatorWindow,
  delayMs: number
) {
  setTimeout(() => {
    controller.reset()
    indicator.hide()
  }, delayMs)
}
```

- [ ] **Step 2: Run dev — full end-to-end test**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

1. Open TextEdit (or any text app), click into the document.
2. Press `Cmd+Shift+V` — indicator pops up bottom-right with red dot ("listening").
3. Say in Indonesian: *"halo dunia ini adalah tes voicecast"*.
4. Press `Cmd+Shift+V` again.
5. Indicator shows "transcribing…" → "pasting…" → "done".
6. Text appears in TextEdit.

If `pasted: false` due to missing Accessibility permission, the text will still be in the clipboard — manually `Cmd+V` works.

- [ ] **Step 3: Commit**

```bash
git add src/main/bootstrap.ts
git commit -m "feat: end-to-end pipeline transcribe -> inject -> fade indicator"
```

---

## Phase 4: Polish

### Task 21: Indicator UI components (visual states)

**Files:**
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/components/Indicator.tsx`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/components/WaveAnim.tsx`
- Create: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/components/Spinner.tsx`
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/App.tsx`
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/src/renderer/styles/globals.css`

- [ ] **Step 1: Create `WaveAnim.tsx`**

```tsx
export function WaveAnim() {
  return (
    <div className="flex items-end gap-[2px] h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-rose-400 animate-[vc-wave_900ms_ease-in-out_infinite]"
          style={{
            animationDelay: `${i * 110}ms`
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `Spinner.tsx`**

```tsx
export function Spinner() {
  return (
    <div className="h-4 w-4 rounded-full border-2 border-amber-300/40 border-t-amber-300 animate-spin" />
  )
}
```

- [ ] **Step 3: Create `Indicator.tsx`**

```tsx
import { Mic, Check, AlertTriangle, ClipboardCopy } from 'lucide-react'
import type { AppState } from '../../shared/types'
import { WaveAnim } from './WaveAnim'
import { Spinner } from './Spinner'

interface Props {
  state: AppState
  message?: string
}

export function Indicator({ state, message }: Props) {
  return (
    <div
      className={`flex h-[72px] w-[220px] items-center gap-3 rounded-2xl bg-neutral-900/90 px-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition-opacity duration-300 ${
        state === 'idle' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <Glyph state={state} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-semibold">{label(state)}</span>
        {message ? (
          <span className="truncate text-[11px] text-neutral-300">{message}</span>
        ) : null}
      </div>
    </div>
  )
}

function Glyph({ state }: { state: AppState }) {
  switch (state) {
    case 'recording':
      return (
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-rose-400" />
          <WaveAnim />
        </div>
      )
    case 'transcribing':
      return <Spinner />
    case 'injecting':
      return <ClipboardCopy className="h-4 w-4 text-sky-400" />
    case 'done':
      return <Check className="h-4 w-4 text-emerald-400" />
    case 'clipboard-only':
      return <ClipboardCopy className="h-4 w-4 text-amber-300" />
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-rose-400" />
    default:
      return <Mic className="h-4 w-4 text-neutral-500" />
  }
}

function label(state: AppState): string {
  switch (state) {
    case 'recording':
      return 'Listening'
    case 'transcribing':
      return 'Transcribing'
    case 'injecting':
      return 'Pasting'
    case 'done':
      return 'Done'
    case 'clipboard-only':
      return 'In Clipboard'
    case 'error':
      return 'Error'
    default:
      return 'VoiceCast'
  }
}
```

- [ ] **Step 4: Add wave keyframes to `globals.css`**

Append to file:

```css
@layer utilities {
  @keyframes vc-wave {
    0%, 100% { height: 0.25rem; }
    50%      { height: 1.25rem; }
  }
}
```

- [ ] **Step 5: Replace `App.tsx` to use Indicator component**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../shared/types'
import { AudioCapture } from './audio/audio-capture'
import { Indicator } from './components/Indicator'

export function App() {
  const [state, setState] = useState<AppState>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const captureRef = useRef<AudioCapture | null>(null)

  useEffect(() => {
    const offState = window.voicecast.onState(({ state: s, message: m }) => {
      setState(s)
      setMessage(m)
    })

    const offStart = window.voicecast.onRecordingStart(async () => {
      try {
        const capture = new AudioCapture()
        captureRef.current = capture
        await capture.start()
      } catch (err) {
        console.error('[VoiceCast] mic error', err)
      }
    })

    const offStop = window.voicecast.onRecordingStop(async () => {
      const capture = captureRef.current
      captureRef.current = null
      if (!capture) {
        await window.voicecast.submitAudio({
          buffer: new ArrayBuffer(0),
          durationMs: 0
        })
        return
      }
      const result = await capture.stop()
      if (!result) {
        await window.voicecast.submitAudio({
          buffer: new ArrayBuffer(0),
          durationMs: 0
        })
        return
      }
      await window.voicecast.submitAudio({
        buffer: result.wav,
        durationMs: result.durationMs
      })
    })

    return () => {
      offState()
      offStart()
      offStop()
    }
  }, [])

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Indicator state={state} message={message} />
    </div>
  )
}
```

- [ ] **Step 6: Run dev and verify visuals**

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

Trigger `Cmd+Shift+V`, speak, trigger again. Observe:
- Recording: red mic icon + animated waves.
- Transcribing: amber spinner.
- Injecting: sky clipboard icon.
- Done: green check + transcript preview.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/ src/renderer/App.tsx src/renderer/styles/globals.css
git commit -m "feat: indicator UI components with state-driven glyphs and wave animation"
```

---

### Task 22: README + final smoke test

**Files:**
- Modify: `/Users/prawito/Documents/code/spt/voice-cast/README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# VoiceCast

System-wide voice-to-text input for desktop. Indonesian-first, offline, privacy-preserving.

> **Status:** Walking skeleton (macOS only, dev mode). See `docs/superpowers/specs/2026-05-08-voicecast-walking-skeleton-design.md`.

## Requirements

- macOS 12+
- Node.js 20 LTS (`nvm use` reads `.nvmrc`)
- ~200 MB free disk for the Whisper `base` model (auto-downloaded on first use)
- Working microphone

## Setup

```bash
nvm use
npm install
npm run dev
```

The first transcription downloads the Whisper `base` model (~145 MB). Subsequent runs are instant.

## macOS permissions

VoiceCast needs two macOS permissions:

1. **Microphone** — granted on first `Cmd+Shift+V` press via the standard system prompt.
2. **Accessibility** — required to paste the transcript into other apps via simulated `Cmd+V`.
   - Open `System Settings -> Privacy & Security -> Accessibility`.
   - Toggle on the entry for `Electron` (during dev) or `VoiceCast` (when packaged).
   - Restart the app after granting.

If Accessibility is denied, VoiceCast falls back to clipboard-only mode: the transcript is in your clipboard and you can paste it manually with `Cmd+V`.

## Usage

1. Run `npm run dev`.
2. Click into any text field (TextEdit, VS Code, Slack, Chrome, etc.).
3. Press `Cmd+Shift+V` to start recording. The indicator (bottom-right of primary screen) turns red and shows wave animation.
4. Speak in Indonesian.
5. Press `Cmd+Shift+V` again to stop. The indicator shows "Transcribing", then "Pasting", then "Done".
6. The transcript is pasted into your focused field.

Recordings are capped at 60 seconds for memory safety.

## Configuration

Configuration is hard-coded in `src/shared/constants.ts` for the walking skeleton:

| Constant | Value |
|---|---|
| `HOTKEY_TOGGLE` | `CommandOrControl+Shift+V` |
| `WHISPER_MODEL_NAME` | `base` |
| `WHISPER_LANGUAGE` | `id` (Indonesian) |
| `MAX_RECORDING_MS` | `60000` |

Settings UI, custom hotkeys, and model/language pickers will land in later phases (see PRD §5.6).

## Project structure

```
src/
├── main/        Node.js main process (hotkey, whisper, injection, indicator window)
├── preload/     contextBridge IPC bridge
├── renderer/    React UI + Web Audio capture + WAV encoder
└── shared/      types and constants
docs/
└── superpowers/
    ├── specs/   design documents
    └── plans/   implementation plans
```

## Privacy

- Audio is captured in-memory on the renderer, encoded to WAV, sent to the main process via IPC, and written to a temp file under `os.tmpdir()` only for the duration of the Whisper call.
- The temp file is deleted immediately after transcription.
- Whisper runs locally — no audio leaves your machine.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Hotkey fails to register | Conflict with another app | Quit clipboard managers / change `HOTKEY_TOGGLE` in `constants.ts` |
| "Microphone permission denied" | macOS prompt dismissed | System Settings -> Privacy & Security -> Microphone -> enable Electron |
| Text in clipboard but not pasted | Accessibility not granted | System Settings -> Privacy & Security -> Accessibility -> enable Electron, then restart app |
| Long initial pause on first use | Whisper model downloading | Wait — ~145 MB; subsequent runs are fast |
| Latency > 3s on Intel Mac | CPU-bound Whisper | Documented; large-model & GPU support is a later phase |

## License

UNLICENSED — internal walking skeleton. Productization decisions pending (see PRD §11).
```

- [ ] **Step 2: Final end-to-end smoke test**

Run through this checklist by hand:

```bash
cd /Users/prawito/Documents/code/spt/voice-cast && npm run dev
```

1. Console logs `[VoiceCast] bootstrap starting`, permission status, then `ready — press Cmd+Shift+V`.
2. Tray icon visible in macOS menu bar.
3. Open TextEdit, place cursor in a new document.
4. Press `Cmd+Shift+V` → indicator appears bottom-right, red mic + waves, label "Listening".
5. Say *"halo dunia ini tes"*.
6. Press `Cmd+Shift+V` → indicator transitions Transcribing (spinner) → Pasting (clipboard icon) → Done (green check) → fades.
7. Transcript appears in TextEdit.
8. Repeat — state machine resets cleanly.
9. Right-click tray → Quit. App exits cleanly.
10. `ls /tmp/voicecast-*.wav` returns nothing (temp files cleaned up).

If all 10 pass, the walking skeleton is done.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with setup, permissions, usage, and troubleshooting"
```

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a v0.1.0-walking-skeleton -m "VoiceCast walking skeleton: hotkey-driven Indonesian voice-to-text on macOS"
```

---

## Self-Review Notes

**Spec coverage check:**
- §2 Architecture (3-process split) → Tasks 6, 7, 9, 10
- §3 Components → all main modules in Tasks 7–10, 14, 16–19; renderer in Tasks 11–13, 21
- §4 State machine → Task 16 (controller), Task 20 (full transitions)
- §5 Data flow → Tasks 12, 13, 14, 17, 19, 20
- §6 Audio format → Task 11
- §7 Latency budget → measured at Task 22 smoke test (informal)
- §8 Tech stack → Task 2 (deps), Tasks 3–4 (configs)
- §9 Project structure → matches Tasks 1–22 file paths
- §10 Permissions → Task 18
- §11 Error handling → covered across Tasks 13 (silence RMS), 17 (max-recording timer), 20 (no-audio / no-text / transcribe error / paste fallback / hotkey conflict via Task 17)
- §12 Definition of Done → Task 22 smoke checklist
- §13 Risks → mitigations live in code (Task 14 dynamic import; Task 19 fallback)

**No placeholders confirmed:** every step shows the exact code or shell command. No "TBD" / "TODO" / "fill in" present.

**Type consistency:** `AppState` defined once (Task 5), used uniformly across `RecordingController` (Task 16), `IndicatorWindow` (Task 9), preload (Task 6), App (Task 13, 21). `IPC` constants single-sourced. Method names: `controller.toggle()`, `controller.reset()`, `controller.setDone()`, `indicator.show()/hide()/pushState()/sendStart()/sendStop()` — used identically wherever called. `submitAudio` and `transcribe` signatures consistent.

**Out-of-spec scope check:** Plan does not introduce features beyond walking skeleton scope. No settings panel, no push-to-talk, no cross-platform code, no automated tests — all consistent with the spec's Out-of-Scope list.
