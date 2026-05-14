const STORAGE_KEY = 'study-helper-tts-voice-uri-local';

/** When `user_settings.tts_voice_uri` is missing from the DB, keep the chosen Web Speech voice here. */
export function readLocalTtsVoiceUri(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const v = raw?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

export function writeLocalTtsVoiceUri(uri: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const v = uri?.trim();
    if (!v) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, v);
    }
  } catch {
    /* quota / private mode */
  }
}
