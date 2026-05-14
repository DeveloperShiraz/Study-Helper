/** Pick a stable default when the user leaves "Voice" on system default. */
export function pickDefaultSpeechVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return undefined;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return undefined;
  }
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const short = lang.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.default && v.lang.toLowerCase().startsWith(short)) ??
    voices.find((v) => v.default) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(short)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    voices[0]
  );
}

export function resolveSpeechVoiceByUri(uri: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return undefined;
  }
  const u = uri.trim();
  if (!u) {
    return undefined;
  }
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.voiceURI === u) ?? voices.find((v) => v.name === u);
}
