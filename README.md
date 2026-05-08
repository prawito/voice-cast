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
