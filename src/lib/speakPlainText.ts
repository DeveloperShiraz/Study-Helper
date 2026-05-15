import { pickDefaultSpeechVoice, resolveSpeechVoiceByUri } from './pickSpeechSynthesisVoice';

export function speakPlainText(text: string, voiceUri: string | null | undefined): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  const resolved = voiceUri?.trim()
    ? resolveSpeechVoiceByUri(voiceUri) ?? pickDefaultSpeechVoice()
    : pickDefaultSpeechVoice();
  if (resolved) {
    utterance.voice = resolved;
  }
  window.speechSynthesis.speak(utterance);
}
