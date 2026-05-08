# VoiceCast — Walking Skeleton Design

**Date:** 2026-05-08
**Author:** Prawito (Head of Technology, PT Star Perkasa Technology)
**Status:** Design approved, pending implementation plan
**Source PRD:** `PRD_VoiceCast.docx` v0.1

## 1. Goal & Scope

Build a **walking skeleton** of VoiceCast that demonstrates the full PRD flow end-to-end on macOS:

> User presses `Cmd+Shift+V`, speaks in Indonesian, presses `Cmd+Shift+V` again, and the transcribed text appears in the currently focused application.

This is **Phase 0–2** of the PRD roadmap (Setup + Core engine + Hotkey/Injection), de-scoped to the minimum that proves the architecture and the latency budget. It is **not** a shippable MVP.

### In scope

- Electron app scaffold (TypeScript, React, Tailwind, Vite)
- Audio capture from default microphone (Web Audio API)
- Local transcription via `nodejs-whisper`, model `base`, language `id`
- Global hotkey `CmdOrCtrl+Shift+V` in **toggle** mode
- Floating indicator window (frameless, transparent, always-on-top, non-focusing)
- Clipboard-paste injection via macOS `osascript`
- Permission detection (microphone, accessibility) with user-facing guidance
- Manual smoke test path

### Out of scope (deferred)

- Settings panel, custom hotkey, model/language selector, push-to-talk
- Cross-platform (Windows / Linux) — macOS-only
- `electron-builder` packaging output (dev mode only)
- Code signing, notarization
- Large model, GPU acceleration
- Automated test suite
- robotjs / nut.js native keyboard simulation
- Auto-start on boot, microphone selector, indicator position config
- Whisper fine-tuning, history log, post-processing

## 2. Architecture

Three-process Electron split:

```
+-------------------------------------------------------------+
| MAIN PROCESS (Node.js)                                      |
|  - HotkeyManager (Electron globalShortcut)                  |
|  - RecordingController (state machine)                      |
|  - TranscriptionService (nodejs-whisper)                    |
|  - InjectionService (clipboard + osascript via execFile)    |
|  - IndicatorWindow controller (frameless BrowserWindow)     |
|  - Tray (quit only)                                         |
|  - IPC orchestration                                        |
+----------------------+--------------------------------------+
                       | IPC via contextBridge
+----------------------v--------------------------------------+
| RENDERER (Indicator UI) - React + Tailwind                  |
|  - AudioCaptureService (Web Audio API + ScriptProcessor)    |
|  - WAV encoder (Float32 -> 16-bit PCM 16kHz mono)           |
|  - Indicator state UI: idle/listening/transcribing/done/err |
+----------------------+--------------------------------------+
                       |
+----------------------v--------------------------------------+
| PRELOAD (bridge)                                            |
|  - Whitelisted IPC channels                                 |
|  - contextIsolation: true, nodeIntegration: false           |
+-------------------------------------------------------------+
```

**Why this split:**
- Web Audio API is renderer-only.
- `nodejs-whisper` is Node-only (main process).
- Indicator window is renderer (frame:false, transparent:true, alwaysOnTop:true, skipTaskbar:true, focusable:false) so it does not steal focus from the target app (FR-19).

**Single-window approach:** The indicator window doubles as the audio-capture host. There is no main settings window; the app lives in the system tray plus a small floating indicator. This is intentionally simpler than the full PRD architecture, which envisions a separate settings window in later phases.

## 3. Components

### Main process (`src/main/`)

| Module | Responsibility | Key dependencies |
|---|---|---|
| `index.ts` | Entry: `app.whenReady()` -> bootstrap | electron |
| `bootstrap.ts` | Wire managers; single-instance lock | (internal) |
| `hotkey-manager.ts` | Register `CmdOrCtrl+Shift+V`, dispatch toggle event | electron.globalShortcut |
| `recording-controller.ts` | State machine (idle <-> recording -> transcribing -> injecting -> idle) | (internal) |
| `transcription-service.ts` | Write WAV to tmpdir -> call whisper -> return text -> unlink | nodejs-whisper, fs, os, crypto |
| `injection-service.ts` | `clipboard.writeText()` then simulate Cmd+V via `child_process.execFile('osascript', [...])` | electron.clipboard, child_process |
| `indicator-window.ts` | Create/show/hide frameless indicator window; push state | electron.BrowserWindow |
| `tray.ts` | System tray icon with quit menu | electron.Tray |
| `ipc-channels.ts` | String constants for IPC channels (type-safe) | (internal) |
| `permissions.ts` | Detect Accessibility permission on macOS; surface guidance | electron.systemPreferences |

**Security note on injection:** Use `child_process.execFile('osascript', ['-e', script])` (not `exec(string)`) so the script argument is never interpolated into a shell command line. The script itself is a constant string with no user input, so command injection is impossible by construction, but `execFile` is the right primitive regardless.

### Renderer (`src/renderer/`)

| Module | Responsibility |
|---|---|
| `App.tsx` | Listens to state via `window.voicecast`; renders indicator |
| `audio/audio-capture.ts` | `getUserMedia` -> AudioContext + ScriptProcessor -> Float32 buffers |
| `audio/wav-encoder.ts` | Downmix to mono -> resample to 16kHz -> Int16 PCM -> WAV header |
| `components/Indicator.tsx` | Visual states (recording dot+wave, transcribing spinner, done check, error icon) |
| `components/WaveAnim.tsx` | CSS-driven mic wave animation |
| `components/Spinner.tsx` | Loading spinner |

### Preload (`src/preload/index.ts`)

Exposes `window.voicecast` with:
- `onState(cb)` — subscribe to state updates from main
- `onRecordingStart(cb)` — main signals start recording
- `onRecordingStop(cb)` — main signals stop and flush audio
- `submitAudio(arrayBuffer)` — renderer sends WAV blob to main

### Shared (`src/shared/`)

- `types.ts` — `AppState` enum, IPC payload interfaces
- `constants.ts` — default hotkey, sample rate (16000), model name (`base`), language (`id`)

## 4. Recording State Machine

```
       hotkey
idle ----------> recording
                    |
                    | hotkey (toggle off)
                    v
               transcribing --error--> error --fade(1.5s)--> idle
                    |                          (with toast)
                    | success
                    v
                 injecting --success--> done --fade(1s)--> idle
                    |
                    | paste failure
                    v
              clipboard-only --fade(2s)--> idle
              (text remains in clipboard)
```

Guards:
- Double hotkey while `recording` -> treated as toggle off.
- Hotkey while `transcribing`/`injecting` -> ignored.
- Recording > 60s -> auto-stop (memory safety) with warning toast.

## 5. Data Flow (Single Recording Session)

1. User presses `Cmd+Shift+V`.
2. `hotkey-manager` -> `recording-controller.toggle()`. State = `recording`.
3. `indicator-window` shown; IPC `state:update` -> renderer; IPC `recording:start` -> renderer.
4. Renderer `audio-capture`: `getUserMedia({audio: true})`, AudioContext at native sample rate, ScriptProcessor pushes Float32 chunks into in-memory buffer.
5. User speaks.
6. User presses `Cmd+Shift+V` again. State = `transcribing`.
7. Renderer stops capture. `wav-encoder` produces 16kHz mono 16-bit PCM WAV blob. IPC `audio:submit(arrayBuffer)`.
8. Main writes blob to `os.tmpdir()/voicecast-<uuid>.wav`. Calls `nodejs-whisper.transcribe(file, { language: "id", model: "base" })`. Receives `text`. Unlinks file.
9. State = `injecting`. `clipboard.writeText(text)`. `child_process.execFile('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])`.
10. State = `done`. Indicator fades after 1s. State -> `idle`.

## 6. Audio Format Conversion

- Web Audio API output: Float32Array per channel, sample rate ~48kHz on Mac.
- Whisper expects: 16-bit signed PCM WAV, mono, 16kHz.
- Conversion in `wav-encoder.ts`:
  1. Downmix to mono (average channels if stereo).
  2. Resample to 16kHz (linear interpolation; sufficient for MVP).
  3. Float32 -> Int16 (clamp to +/-1, multiply by 32767).
  4. Prepend 44-byte WAV header (RIFF, fmt, data chunks).

## 7. Latency Budget (FR-09: <=2s for <=15s audio, base model)

| Step | Estimate (Apple Silicon) |
|---|---|
| Stop capture, encode WAV | ~50 ms |
| IPC transfer (~1 MB) | ~20 ms |
| Disk write tmp file | ~30 ms |
| Whisper base transcribe (15s audio) | ~800-1500 ms |
| Clipboard write + osascript Cmd+V | ~100 ms |
| **Total** | **~1.0-1.7 s** ✓ |

Intel Mac estimate: 2.5-3.5s (acceptable for walking skeleton; documented).

## 8. Tech Stack

| Layer | Package | Version |
|---|---|---|
| Node | — | 20.x LTS |
| Electron | `electron` | ^33.x |
| Build | `electron-vite` | ^2.3.x |
| Bundler | `vite` | ^5.x |
| Language | `typescript` | ^5.5.x |
| UI | `react` + `react-dom` | ^18.3.x |
| Styling | `tailwindcss` + `postcss` + `autoprefixer` | ^3.4.x |
| Whisper | `nodejs-whisper` | ^0.2.x |
| Icons | `lucide-react` | ^0.4xx |
| Packaging | `electron-builder` | ^25.x (config only, not run) |

No state library (Redux/Zustand) — renderer state is trivial. No testing framework — manual smoke tests only.

Whisper model `base` (~145 MB) is auto-downloaded by `nodejs-whisper` on first transcription. Language hardcoded to `id`.

## 9. Project Structure

```
voice-cast/
- package.json
- tsconfig.json
- tsconfig.main.json
- tsconfig.renderer.json
- electron.vite.config.ts
- electron-builder.yml
- tailwind.config.js
- postcss.config.js
- .gitignore
- .nvmrc
- README.md
- resources/
  - icon.png
- src/
  - main/
    - index.ts
    - bootstrap.ts
    - hotkey-manager.ts
    - recording-controller.ts
    - transcription-service.ts
    - injection-service.ts
    - indicator-window.ts
    - tray.ts
    - ipc-channels.ts
    - permissions.ts
  - preload/
    - index.ts
  - renderer/
    - index.html
    - main.tsx
    - App.tsx
    - audio/
      - audio-capture.ts
      - wav-encoder.ts
    - components/
      - Indicator.tsx
      - WaveAnim.tsx
      - Spinner.tsx
    - styles/
      - globals.css
  - shared/
    - types.ts
    - constants.ts
- docs/
  - superpowers/
    - specs/
      - 2026-05-08-voicecast-walking-skeleton-design.md  <- this file
```

Target: <=200 LOC per source file.

## 10. Permissions (macOS)

- **Microphone** — system prompt fires automatically on first `getUserMedia()`. Denied state surfaces as an error toast in indicator + console message.
- **Accessibility** — required for `osascript ... keystroke` to send `Cmd+V` to other apps. Cannot be auto-granted.
  - On startup, call `systemPreferences.isTrustedAccessibilityClient(false)`.
  - If false: tray balloon + console message "Open System Settings -> Privacy & Security -> Accessibility -> enable VoiceCast (Electron)".
  - App still functions in clipboard-only mode (text written to clipboard, user pastes manually) until accessibility granted.

## 11. Error Handling Matrix

| Failure | Detection | Response |
|---|---|---|
| Mic permission denied | `getUserMedia` rejects | Indicator -> error "Microphone permission denied"; fade 3s; console instructions |
| No audio detected | RMS check post-recording (threshold ~-50 dBFS) | Indicator -> warning "No audio detected"; skip transcribe; fade 2s |
| Whisper model download fails | `nodejs-whisper` throws | Indicator -> error "Model download failed"; retry on next hotkey |
| Whisper transcription throws | try/catch | Indicator -> error "Transcription failed"; reset state |
| Empty transcription text | `text.trim() === ""` | Indicator -> warning "No text recognized"; skip injection |
| Clipboard write fails | exception | Indicator -> error; reset |
| osascript paste fails (no Accessibility) | exit code !== 0 | Fallback: indicator "Text in clipboard - Cmd+V manually"; instruct setup |
| Hotkey already registered | `globalShortcut.register` returns false | Console error + tray notification "Hotkey conflict" |
| Double hotkey while recording | state machine guard | Treat as toggle off |
| Hotkey during transcribing/injecting | state machine guard | Ignore |
| Recording > 60s | duration timer in renderer | Auto-stop; warning "Long recording" |

## 12. Definition of Done

1. `npm install && npm run dev` works on macOS.
2. App launches with tray icon (no main window visible).
3. `Cmd+Shift+V` triggers recording; indicator window appears showing "Listening".
4. Pressing `Cmd+Shift+V` again: audio is buffered, transcribed via Whisper base (Indonesian), text is pasted into the focused app.
5. State machine resets; ready for the next recording.
6. Microphone permission prompt appears on first use.
7. Accessibility instructions appear (in console/tray) when permission is missing.
8. Audio temp file is unlinked immediately after transcription.
9. README contains setup instructions, dev run command, and permission notes.

## 13. Risks for Walking Skeleton

| Risk | Mitigation |
|---|---|
| `nodejs-whisper` bundling with Electron may have native binary issues | Fallback: spawn whisper.cpp binary directly via `child_process.spawn` (deferred to plan if encountered) |
| First-time model download UX (~145 MB, 30s-2min) | Indicator shows "Downloading model..." without progress bar; documented in README |
| Latency on Intel Mac may exceed 2s target | Documented; acceptable for walking skeleton |
| Accessibility permission friction | Clear console + tray instructions; clipboard-only fallback works without accessibility |
| `osascript` paste may fail in apps that intercept Cmd+V differently | Fallback: leave text in clipboard, instruct manual paste |

## 14. Notes on PRD Compliance

This walking skeleton **complies with the spirit** of these PRD requirements at reduced scope:

- FR-01 mic capture ✓
- FR-02 toggle mode (push-to-talk deferred) — partial
- FR-03 mic permission ✓
- FR-04 audio not persisted to disk — partial (tmpfile written briefly then unlinked; documented trade-off)
- FR-05 whisper.cpp transcription ✓ (via nodejs-whisper)
- FR-06/07 model selector — deferred (base hardcoded)
- FR-08 language — Indonesian default, hardcoded (selector deferred)
- FR-09 latency — targeted ✓
- FR-10/11/12/13 injection ✓ (clipboard-paste, no focus loss)
- FR-14 default hotkey ✓
- FR-15 customizable hotkey — deferred
- FR-16 hotkey conflict detection — partial (logged, not interactive)
- FR-17/18/19/20 indicator window ✓ (position config deferred)
- FR-21–24 error handling ✓
- §5.6 Settings panel — deferred entirely

Non-functional requirements (latency, RAM, privacy, OS support) are best-effort; not formally measured in walking skeleton.

## 15. Next Steps

After this design is approved:
1. Invoke `superpowers:writing-plans` to produce a phased implementation plan with verification steps per phase.
2. Execute the plan, validating each phase by manual smoke test on macOS.
