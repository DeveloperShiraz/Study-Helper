import type { Provider } from '../types';

export const OTHER_MODEL_VALUE = '__other__';

export interface ProviderModelOption {
  value: string;
  label: string;
}

const OPENAI_MODELS: ProviderModelOption[] = [
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano' },
  { value: 'o3', label: 'o3' },
  { value: 'o3-mini', label: 'o3-mini' },
  { value: 'o4-mini', label: 'o4-mini' },
  { value: 'gpt-5', label: 'gpt-5' },
  { value: 'gpt-5-mini', label: 'gpt-5-mini' },
  { value: 'gpt-5-nano', label: 'gpt-5-nano' },
];

/**
 * Bedrock `InvokeModel` modelId values from AWS Anthropic model cards (2026).
 * Newer Claude 4.x models often require a geo/global inference profile (e.g. `us.…`) for on-demand;
 * the bare `anthropic.…` id may return 400 without provisioned throughput.
 */
const BEDROCK_CLAUDE_MODELS: ProviderModelOption[] = [
  { value: 'us.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (US inference profile)' },
  { value: 'eu.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (EU inference profile)' },
  { value: 'au.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (AU inference profile)' },
  { value: 'jp.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (JP inference profile)' },
  { value: 'global.anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (global inference profile)' },
  { value: 'anthropic.claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (base id — may need provisioned throughput)' },
  { value: 'us.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (US inference profile)' },
  { value: 'eu.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (EU inference profile)' },
  { value: 'au.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (AU inference profile)' },
  { value: 'global.anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (global inference profile)' },
  { value: 'anthropic.claude-opus-4-6-v1', label: 'Claude Opus 4.6 (base id)' },
  { value: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (US inference profile)' },
  { value: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (EU inference profile)' },
  { value: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (global inference profile)' },
  { value: 'anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5 (base id)' },
  { value: 'us.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (US inference profile)' },
  { value: 'eu.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (EU inference profile)' },
  { value: 'global.anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (global inference profile)' },
  { value: 'anthropic.claude-opus-4-5-20251101-v1:0', label: 'Claude Opus 4.5 (base id)' },
  { value: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (US inference profile)' },
  { value: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (EU inference profile)' },
  { value: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (global inference profile)' },
  { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (base id)' },
  { value: 'us.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (US inference profile)' },
  { value: 'eu.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (EU inference profile)' },
  { value: 'apac.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (APAC inference profile)' },
  { value: 'global.anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (global inference profile)' },
  { value: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (base id)' },
  { value: 'anthropic.claude-3-5-sonnet-20240620-v1:0', label: 'Claude 3.5 Sonnet' },
  { value: 'anthropic.claude-3-5-haiku-20240307-v1:0', label: 'Claude 3.5 Haiku' },
  { value: 'anthropic.claude-3-opus-20240229-v1:0', label: 'Claude 3 Opus' },
  { value: 'anthropic.claude-3-sonnet-20240229-v1:0', label: 'Claude 3 Sonnet' },
  { value: 'anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku' },
];

const ANTHROPIC_MODELS: ProviderModelOption[] = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
];

const GEMINI_MODELS: ProviderModelOption[] = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (stable)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (preview)' },
  { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking (exp.)' },
];

const DEEPSEEK_MODELS: ProviderModelOption[] = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-chat', label: 'deepseek-chat (legacy)' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner (legacy)' },
];

const OPENROUTER_MODELS: ProviderModelOption[] = [
  { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
  { value: 'anthropic/claude-3.7-sonnet', label: 'Anthropic Claude 3.7 Sonnet' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
  { value: 'google/gemini-2.5-flash-preview-05-20', label: 'Google Gemini 2.5 Flash (preview)' },
  { value: 'google/gemini-2.0-flash-001', label: 'Google Gemini 2.0 Flash' },
  { value: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3 Chat' },
  { value: 'deepseek/deepseek-r1-0528', label: 'DeepSeek R1' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 70B' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1' },
  { value: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B' },
];

const NVIDIA_MODELS: ProviderModelOption[] = [
  { value: 'meta/llama3-70b-instruct', label: 'Llama 3 70B Instruct' },
  { value: 'meta/llama3-8b-instruct', label: 'Llama 3 8B Instruct' },
  { value: 'mistralai/mistral-7b-instruct-v0.2', label: 'Mistral 7B Instruct' },
  { value: 'nvidia/nemotron-4-340b-instruct', label: 'Nemotron-4 340B Instruct' },
  { value: 'deepseek-ai/deepseek-v3.1', label: 'DeepSeek V3.1' },
];

export const PRESET_MODELS_BY_PROVIDER: Record<Exclude<Provider, 'custom'>, readonly ProviderModelOption[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  bedrock: BEDROCK_CLAUDE_MODELS,
  gemini: GEMINI_MODELS,
  deepseek: DEEPSEEK_MODELS,
  openrouter: OPENROUTER_MODELS,
  nvidia: NVIDIA_MODELS,
};

export function presetSelectValueForStoredModel(
  provider: Exclude<Provider, 'custom'>,
  storedModel: string,
): string {
  const trimmed = storedModel.trim();
  const list = PRESET_MODELS_BY_PROVIDER[provider];
  const hit = list.some((o) => o.value === trimmed);
  return hit ? trimmed : OTHER_MODEL_VALUE;
}

export function otherModelOption(): ProviderModelOption {
  return { value: OTHER_MODEL_VALUE, label: 'Other (enter model id…)' };
}
