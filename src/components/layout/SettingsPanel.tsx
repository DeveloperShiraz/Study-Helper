import { useEffect, useState, type FormEvent } from 'react';
import { callAI } from '../../ai/adapter';
import { supabase } from '../../lib/supabase';
import { mapUserSettings, type UserSettingsRow } from '../../lib/dbMappers';
import { PROVIDER_BASE_URLS, PROVIDER_OPTIONS } from '../../lib/providerUrls';
import { useApp } from '../../context/AppContext';
import type { Provider, UserSettings } from '../../types';

const TEST_SYSTEM = 'You are a ping endpoint. Reply with exactly: OK';

export function SettingsPanel() {
  const { state, dispatch } = useApp();
  const { user, settings, isSettingsPanelOpen, isFirstLaunch } = state;
  const [provider, setProvider] = useState<Provider>('openrouter');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_BASE_URLS.openrouter);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setProvider(settings.provider);
    setModel(settings.model);
    setApiKey(settings.apiKey);
    setBaseUrl(settings.baseUrl);
    setYoutubeUrl(settings.youtubeUrl ?? '');
  }, [settings]);

  useEffect(() => {
    if (provider === 'custom') return;
    setBaseUrl(PROVIDER_BASE_URLS[provider]);
  }, [provider]);

  if (!isSettingsPanelOpen || !user) return null;

  const sessionUser = user;

  const panelTitle = isFirstLaunch ? "Let's get you set up" : 'AI Settings';
  const panelSubtitle = isFirstLaunch ? 'Pick your AI provider and enter your API key.' : undefined;

  async function handleTestConnection() {
    setIsTesting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    const draft: UserSettings = {
      userId: sessionUser.id,
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim() || 'test',
    };
    try {
      await callAI('Reply with OK only.', TEST_SYSTEM, draft);
      setStatusMessage('Connection succeeded.');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const trimmedKey = apiKey.trim();
    const trimmedModel = model.trim();
    const trimmedBase = baseUrl.trim();

    if (!trimmedKey || !trimmedModel || !trimmedBase) {
      setErrorMessage('Model, API key, and base URL are required.');
      setIsSaving(false);
      return;
    }

    const payload = {
      user_id: sessionUser.id,
      provider,
      base_url: trimmedBase,
      api_key: trimmedKey,
      model: trimmedModel,
      youtube_url: youtubeUrl.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    const { data } = await supabase.from('user_settings').select('*').eq('user_id', sessionUser.id).single();

    if (data) {
      dispatch({ type: 'SET_SETTINGS', payload: mapUserSettings(data as UserSettingsRow) });
    }

    dispatch({ type: 'SET_FIRST_LAUNCH', payload: false });
    dispatch({ type: 'SET_SETTINGS_PANEL', payload: false });
    setIsSaving(false);
  }

  function handleClose() {
    dispatch({ type: 'SET_SETTINGS_PANEL', payload: false });
  }

  const providerSelectClass =
    'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close settings" onClick={handleClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{panelTitle}</h2>
            {panelSubtitle && <p className="mt-1 text-sm text-gray-600">{panelSubtitle}</p>}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <label className="text-sm font-medium text-gray-700" htmlFor="settings-provider">
            Provider
          </label>
          <select
            id="settings-provider"
            className={providerSelectClass}
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="mt-4 text-sm font-medium text-gray-700" htmlFor="settings-model">
            Model
          </label>
          <input
            id="settings-model"
            className={inputClass}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. deepseek/deepseek-chat-v3"
            autoComplete="off"
          />

          <label className="mt-4 text-sm font-medium text-gray-700" htmlFor="settings-api-key">
            API Key
          </label>
          <div className="relative mt-1">
            <input
              id="settings-api-key"
              className={`${inputClass} pr-10`}
              type={isKeyVisible ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              onClick={() => setIsKeyVisible((v) => !v)}
            >
              {isKeyVisible ? 'Hide' : 'Show'}
            </button>
          </div>

          <label className="mt-4 text-sm font-medium text-gray-700" htmlFor="settings-base-url">
            Base URL
          </label>
          <input
            id="settings-base-url"
            className={inputClass}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={provider !== 'custom'}
            autoComplete="off"
          />

          <label className="mt-4 text-sm font-medium text-gray-700" htmlFor="settings-youtube">
            YouTube playlist URL (optional)
          </label>
          <input
            id="settings-youtube"
            className={inputClass}
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Playlist (?list=…) or video (?v=…)"
            autoComplete="off"
          />

          {statusMessage && <p className="mt-4 text-sm text-green-700">{statusMessage}</p>}
          {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isTesting ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
