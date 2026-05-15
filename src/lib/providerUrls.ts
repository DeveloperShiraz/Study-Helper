import type { Provider } from '../types';
import { bedrockRuntimeBaseUrl } from './aiTaskSettings';

export const PROVIDER_BASE_URLS: Record<Exclude<Provider, 'custom' | 'bedrock'>, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

export const BEDROCK_DEFAULT_REGION = 'us-east-1';

export const DEFAULT_BEDROCK_BASE_URL = bedrockRuntimeBaseUrl(BEDROCK_DEFAULT_REGION);

export function defaultBaseUrlForProvider(provider: Exclude<Provider, 'custom'>, bedrockRegion: string): string {
  if (provider === 'bedrock') {
    return bedrockRuntimeBaseUrl(bedrockRegion.trim() || BEDROCK_DEFAULT_REGION);
  }
  return PROVIDER_BASE_URLS[provider];
}

export const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'nvidia', label: 'NVIDIA NIM' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'bedrock', label: 'Amazon Bedrock' },
  { value: 'custom', label: 'Custom' },
];
