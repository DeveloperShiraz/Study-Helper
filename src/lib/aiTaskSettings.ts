import type { AiTaskOverrideKey, UserSettings } from '../types';

/** Host for Bedrock Runtime InvokeModel (SigV4). */
export function bedrockRuntimeBaseUrl(region: string): string {
  const r = region.trim() || 'us-east-1';
  return `https://bedrock-runtime.${r}.amazonaws.com`;
}

/**
 * Merge optional per-task profile onto base settings.
 * `chat` covers explain, simplify, extractions, and Settings “Test connection”.
 * `pdfImport` covers PDF segment import and “+ Chapter” PDF text pipeline where applicable.
 */
export function resolveAiSettingsForTask(base: UserSettings, task: AiTaskOverrideKey): UserSettings {
  const profile = base.taskAiOverrides?.[task];
  if (!profile) {
    return base;
  }
  return {
    ...base,
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey: profile.apiKey,
    bedrockAccessKeyId: profile.bedrockAccessKeyId ?? base.bedrockAccessKeyId,
    bedrockRegion: profile.bedrockRegion ?? base.bedrockRegion,
  };
}
