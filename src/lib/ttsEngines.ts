/**
 * TTS engines stored in user_settings.tts_engine.
 * Today only `browser` needs no API key or card; cloud engines can be added later with their own keys.
 */
export const TTS_ENGINE_BROWSER = 'browser' as const;

export type TtsEngine = typeof TTS_ENGINE_BROWSER;

export interface TtsEngineOption {
  id: TtsEngine;
  label: string;
  blurb: string;
}

export const TTS_ENGINE_OPTIONS: TtsEngineOption[] = [
  {
    id: TTS_ENGINE_BROWSER,
    label: 'Browser Web Speech',
    blurb:
      'Free: no account and no payment. Uses voices built into this device and browser. Quality varies (often better on Chrome/Edge with OS neural voices installed).',
  },
];

export const TTS_CLOUD_NOTE =
  'Most cloud neural TTS (Google Cloud, Azure Speech, AWS Polly, OpenAI TTS, ElevenLabs, etc.) needs a developer account; many require a billing method on file even when monthly free quotas apply. Those can be added later as separate engines with their own API keys.';
