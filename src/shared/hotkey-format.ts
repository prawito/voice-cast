const MOD_GLYPHS: Record<string, string> = {
  CommandOrControl: '⌘',
  CmdOrCtrl: '⌘',
  Command: '⌘',
  Cmd: '⌘',
  Meta: '⌘',
  Super: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Shift: '⇧',
  Alt: '⌥',
  Option: '⌥'
}

const KEY_LABELS: Record<string, string> = {
  Return: '↩',
  Enter: '↩',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  Escape: 'Esc',
  Esc: 'Esc',
  Space: 'Space',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Plus: '+',
  ',': ',',
  '.': '.',
  '/': '/',
  '\\': '\\',
  ';': ';',
  "'": "'",
  '[': '[',
  ']': ']',
  '`': '`',
  '-': '-',
  '=': '='
}

export function formatAccelerator(accel: string | null | undefined): string {
  if (!accel) return 'Not set'
  const parts = accel.split('+')
  return parts
    .map((p) => MOD_GLYPHS[p] ?? KEY_LABELS[p] ?? p)
    .join('')
}

export interface KeyEventLike {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const MOD_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'OS', 'AltGraph'])

const CODE_MAP: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Return',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown'
}

export interface CaptureResult {
  accelerator: string | null
  cancelled: boolean
}

export function captureFromKeyboardEvent(e: KeyEventLike): CaptureResult {
  if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    return { accelerator: null, cancelled: true }
  }
  if (MOD_KEYS.has(e.key)) {
    return { accelerator: null, cancelled: false }
  }

  const mods: string[] = []
  if (e.metaKey) mods.push('Cmd')
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')

  if (mods.length === 0) {
    return { accelerator: null, cancelled: false }
  }

  const key = codeToAccelKey(e.code, e.key)
  if (!key) return { accelerator: null, cancelled: false }

  return { accelerator: [...mods, key].join('+'), cancelled: false }
}

function codeToAccelKey(code: string, fallbackKey: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`
  if (/^F\d{1,2}$/.test(code)) return code
  if (code in CODE_MAP) return CODE_MAP[code]
  if (fallbackKey.length === 1) return fallbackKey.toUpperCase()
  return null
}
