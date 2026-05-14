import type { Provider } from '../types';

export const PROVIDER_BASE_URLS: Record<Exclude<Provider, 'custom'>, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

export const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'nvidia', label: 'NVIDIA NIM' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: 'Custom' },
];
