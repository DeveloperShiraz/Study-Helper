import type { ReactNode } from 'react';
import type { Provider } from '../../../types';
import {
  OTHER_MODEL_VALUE,
  otherModelOption,
  PRESET_MODELS_BY_PROVIDER,
} from '../../../lib/providerModels';
import { PROVIDER_OPTIONS } from '../../../lib/providerUrls';

export interface AiProviderCredentialsFieldsProps {
  idPrefix: string;
  provider: Provider;
  onProviderChange: (next: Provider) => void;
  presetSelectValue: string;
  onPresetModelChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  isKeyVisible: boolean;
  onToggleKeyVisible: () => void;
  bedrockAccessKeyId: string;
  onBedrockAccessKeyIdChange: (value: string) => void;
  bedrockRegion: string;
  onBedrockRegionChange: (value: string) => void;
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  providerSelectClass: string;
  inputClass: string;
  geminiHelp?: ReactNode;
}

export function syncPresetAndModelForProvider(nextProvider: Provider, currentModel: string): {
  presetSelectValue: string;
  model: string;
} {
  if (nextProvider === 'custom') {
    return { presetSelectValue: OTHER_MODEL_VALUE, model: currentModel };
  }
  const list = PRESET_MODELS_BY_PROVIDER[nextProvider];
  const first = list[0]?.value;
  if (first) {
    return { presetSelectValue: first, model: first };
  }
  return { presetSelectValue: OTHER_MODEL_VALUE, model: currentModel };
}

export function AiProviderCredentialsFields({
  idPrefix,
  provider,
  onProviderChange,
  presetSelectValue,
  onPresetModelChange,
  model,
  onModelChange,
  apiKey,
  onApiKeyChange,
  isKeyVisible,
  onToggleKeyVisible,
  bedrockAccessKeyId,
  onBedrockAccessKeyIdChange,
  bedrockRegion,
  onBedrockRegionChange,
  baseUrl,
  onBaseUrlChange,
  providerSelectClass,
  inputClass,
  geminiHelp,
}: AiProviderCredentialsFieldsProps) {
  const presetModelOptions =
    provider === 'custom' ? [] : [...PRESET_MODELS_BY_PROVIDER[provider], otherModelOption()];
  const isBaseUrlEditable = provider === 'custom';
  const isBedrockIam = provider === 'bedrock' && bedrockAccessKeyId.trim().length > 0;
  const apiKeyLabel =
    provider === 'bedrock' ? (isBedrockIam ? 'IAM secret access key' : 'Bedrock API key') : 'API key';

  return (
    <>
      <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={`${idPrefix}-provider`}>
        Provider
      </label>
      <select
        id={`${idPrefix}-provider`}
        className={providerSelectClass}
        value={provider}
        onChange={(e) => onProviderChange(e.target.value as Provider)}
      >
        {PROVIDER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={`${idPrefix}-model`}>
        Model
      </label>
      {provider === 'custom' ? (
        <input
          id={`${idPrefix}-model`}
          className={inputClass}
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="Full model id for your endpoint"
          autoComplete="off"
        />
      ) : (
        <>
          <select
            id={`${idPrefix}-model-preset`}
            className={providerSelectClass}
            value={presetSelectValue}
            onChange={(e) => onPresetModelChange(e.target.value)}
          >
            {presetModelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {presetSelectValue === OTHER_MODEL_VALUE && (
            <input
              id={`${idPrefix}-model-custom`}
              className={inputClass}
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="Enter Bedrock or provider model id"
              autoComplete="off"
            />
          )}
        </>
      )}

      {provider === 'bedrock' && (
        <>
          <label
            className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor={`${idPrefix}-bedrock-region`}
          >
            Region
          </label>
          <input
            id={`${idPrefix}-bedrock-region`}
            className={inputClass}
            value={bedrockRegion}
            onChange={(e) => onBedrockRegionChange(e.target.value)}
            placeholder="us-east-1"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Host is <span className="font-mono">bedrock-runtime.&lt;region&gt;.amazonaws.com</span>. Use the same region
            as in the AWS console where you created the API key.
          </p>
          <label
            className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor={`${idPrefix}-bedrock-access-key-id`}
          >
            IAM access key ID (optional)
          </label>
          <input
            id={`${idPrefix}-bedrock-access-key-id`}
            className={inputClass}
            value={bedrockAccessKeyId}
            onChange={(e) => onBedrockAccessKeyIdChange(e.target.value)}
            placeholder="Leave empty for Bedrock API key (Bearer)"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Only if you use long-term IAM keys: then the field below must be the matching secret access key (SigV4).
            Otherwise leave this empty and use a Bedrock API key from the console.
          </p>
        </>
      )}

      <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={`${idPrefix}-api-key`}>
        {apiKeyLabel}
      </label>
      {provider === 'gemini' && geminiHelp}
      <div className="relative mt-1">
        <input
          id={`${idPrefix}-api-key`}
          className={`${inputClass} pr-10`}
          type={isKeyVisible ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          onClick={onToggleKeyVisible}
        >
          {isKeyVisible ? 'Hide' : 'Show'}
        </button>
      </div>

      <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={`${idPrefix}-base-url`}>
        Base URL
      </label>
      <input
        id={`${idPrefix}-base-url`}
        className={inputClass}
        value={baseUrl}
        onChange={(e) => onBaseUrlChange(e.target.value)}
        disabled={!isBaseUrlEditable}
        autoComplete="off"
      />
    </>
  );
}
