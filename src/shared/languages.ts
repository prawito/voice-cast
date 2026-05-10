export interface LanguageOption {
  code: string
  label: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'id', label: 'Indonesian' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'ko', label: 'Korean' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' }
]

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}
