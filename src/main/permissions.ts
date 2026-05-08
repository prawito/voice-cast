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
