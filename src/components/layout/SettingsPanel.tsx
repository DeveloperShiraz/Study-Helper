import { useEffect, useState, type FormEvent } from 'react';
import { callAI } from '../../ai/adapter';
import { supabase } from '../../lib/supabase';
import { mapUserSettings, READER_FONT_PX_DEFAULT, READER_FONT_PX_MAX, READER_FONT_PX_MIN, READER_MARKDOWN_H2_OFFSET_PX, OUTLINE_FONT_PX_DEFAULT, OUTLINE_FONT_PX_MIN, OUTLINE_FONT_PX_MAX, OUTLINE_FONT_LS_KEY, type UserSettingsRow } from '../../lib/dbMappers';
import { isReaderFontColumnUnavailableError, isThemeColumnUnavailableError, isTtsColumnUnavailableError } from '../../lib/themePersist';
import { writeLocalTtsVoiceUri, readLocalTtsVoiceUri } from '../../lib/ttsVoiceLocalFallback';
import {
  OTHER_MODEL_VALUE,
  otherModelOption,
  PRESET_MODELS_BY_PROVIDER,
  presetSelectValueForStoredModel,
} from '../../lib/providerModels';
import { PROVIDER_BASE_URLS, PROVIDER_OPTIONS } from '../../lib/providerUrls';
import { TTS_CLOUD_NOTE, TTS_ENGINE_OPTIONS } from '../../lib/ttsEngines';
import { useApp } from '../../context/AppContext';
import type { Provider, UserSettings } from '../../types';
import { ThemeToggle } from './ThemeToggle';

const TEST_SYSTEM = 'You are a ping endpoint. Reply with exactly: OK';

const GEMINI_DOCS_MULTIMODAL_HREF = 'https://ai.google.dev/gemini-api/docs/prompting_with_media';
const GEMINI_DOCS_MODELS_HREF = 'https://ai.google.dev/gemini-api/docs/models/gemini';

export function SettingsPanel() {
  const { state, dispatch } = useApp();
  const { user, settings, isSettingsPanelOpen, isFirstLaunch } = state;
  const [provider, setProvider] = useState<Provider>('openrouter');
  const [presetSelectValue, setPresetSelectValue] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_BASE_URLS.openrouter);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ttsVoiceUri, setTtsVoiceUri] = useState('');
  const [readerFontPx, setReaderFontPx] = useState(READER_FONT_PX_DEFAULT);
  const [outlineFontPx, setOutlineFontPx] = useState(() => {
    try {
      const stored = localStorage.getItem(OUTLINE_FONT_LS_KEY);
      return stored ? Math.max(OUTLINE_FONT_PX_MIN, Math.min(OUTLINE_FONT_PX_MAX, Number(stored))) : OUTLINE_FONT_PX_DEFAULT;
    } catch {
      return OUTLINE_FONT_PX_DEFAULT;
    }
  });
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setProvider(settings.provider);
    setModel(settings.model);
    if (settings.provider === 'custom') {
      setPresetSelectValue(OTHER_MODEL_VALUE);
    } else {
      setPresetSelectValue(presetSelectValueForStoredModel(settings.provider, settings.model));
    }
    setApiKey(settings.apiKey);
    setBaseUrl(settings.baseUrl);
    setYoutubeUrl(settings.youtubeUrl ?? '');
    setTtsVoiceUri(settings.ttsVoiceUri ?? readLocalTtsVoiceUri() ?? '');
    setReaderFontPx(settings.readerFontPx);
  }, [settings]);

  useEffect(() => {
    if (settings) return;
    if (provider === 'custom') return;
    if (model.trim()) return;
    const list = PRESET_MODELS_BY_PROVIDER[provider];
    const first = list[0]?.value;
    if (first) {
      setPresetSelectValue(first);
      setModel(first);
      return;
    }
    setPresetSelectValue(OTHER_MODEL_VALUE);
  }, [settings, provider, model]);

  useEffect(() => {
    if (provider === 'custom') return;
    setBaseUrl(PROVIDER_BASE_URLS[provider]);
  }, [provider]);

  useEffect(() => {
    if (!isSettingsPanelOpen) {
      return;
    }
    function loadVoices() {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setBrowserVoices([]);
        return;
      }
      const list = window.speechSynthesis.getVoices().slice();
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBrowserVoices(list);
    }
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [isSettingsPanelOpen]);

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
      theme: state.theme,
      readerFontPx,
      ttsEngine: 'browser',
      ttsVoiceUri: ttsVoiceUri.trim() || null,
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
      theme: state.theme,
      reader_font_px: Math.min(READER_FONT_PX_MAX, Math.max(READER_FONT_PX_MIN, Math.round(readerFontPx))),
      tts_engine: 'browser',
      tts_voice_uri: ttsVoiceUri.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let current: Record<string, unknown> = { ...payload };
    let upsertError = (
      await supabase.from('user_settings').upsert(current as never, { onConflict: 'user_id' })
    ).error;
    const fallbackNotes: string[] = [];

    if (upsertError && isTtsColumnUnavailableError(upsertError.message)) {
      delete current.tts_engine;
      delete current.tts_voice_uri;
      upsertError = (
        await supabase.from('user_settings').upsert(current as never, { onConflict: 'user_id' })
      ).error;
      if (!upsertError) {
        fallbackNotes.push(
          'Read aloud: run supabase/migrations/003_user_settings_tts.sql (and NOTIFY pgrst) so your voice can sync to the account; until then it is kept in this browser only.',
        );
      }
    }

    if (upsertError && isThemeColumnUnavailableError(upsertError.message)) {
      delete current.theme;
      upsertError = (
        await supabase.from('user_settings').upsert(current as never, { onConflict: 'user_id' })
      ).error;
      if (!upsertError) {
        fallbackNotes.push(
          'Theme could not sync to the account (missing column or stale PostgREST cache). Run supabase/migrations/004_ensure_user_settings_theme.sql (see themePersist.ts).',
        );
      }
    }

    if (upsertError && isReaderFontColumnUnavailableError(upsertError.message)) {
      delete current.reader_font_px;
      upsertError = (
        await supabase.from('user_settings').upsert(current as never, { onConflict: 'user_id' })
      ).error;
      if (!upsertError) {
        fallbackNotes.push(
          'Reader font size will use the default until you run supabase/migrations/005_user_settings_reader_font.sql (see themePersist.ts).',
        );
      }
    }

    if (!upsertError && fallbackNotes.length > 0) {
      setStatusMessage(fallbackNotes.join(' '));
    }

    if (upsertError) {
      setErrorMessage(upsertError.message);
      setIsSaving(false);
      return;
    }

    writeLocalTtsVoiceUri(ttsVoiceUri.trim() || null);
    try {
      localStorage.setItem(OUTLINE_FONT_LS_KEY, String(outlineFontPx));
      document.documentElement.style.setProperty('--study-helper-outline-font', `${outlineFontPx}px`);
    } catch { /* ignore quota / private mode */ }

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

  function handleProviderChange(nextProvider: Provider) {
    setProvider(nextProvider);
    if (nextProvider === 'custom') {
      setPresetSelectValue(OTHER_MODEL_VALUE);
      return;
    }
    const list = PRESET_MODELS_BY_PROVIDER[nextProvider];
    const first = list[0]?.value;
    if (first) {
      setPresetSelectValue(first);
      setModel(first);
      return;
    }
    setPresetSelectValue(OTHER_MODEL_VALUE);
  }

  function handlePresetModelChange(value: string) {
    setPresetSelectValue(value);
    if (value !== OTHER_MODEL_VALUE) {
      setModel(value);
    }
  }

  const providerSelectClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

  const presetModelOptions =
    provider === 'custom' ? [] : [...PRESET_MODELS_BY_PROVIDER[provider], otherModelOption()];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close settings" onClick={handleClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{panelTitle}</h2>
            {panelSubtitle && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{panelSubtitle}</p>}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Appearance</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Theme and appearance follow your account once settings are saved. If the database has no explicit theme
              yet, the app falls back to this browser&apos;s last choice.
            </p>
            <div className="mt-2">
              <ThemeToggle />
            </div>
            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="reader-font">
              Reader text size
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Scales all content text ({READER_FONT_PX_MIN}–{READER_FONT_PX_MAX}px): reading area, topic listings, and
              cards. The app header stays fixed. Markdown ## headings are {READER_MARKDOWN_H2_OFFSET_PX}px larger.
            </p>
            <input
              id="reader-font"
              type="range"
              min={READER_FONT_PX_MIN}
              max={READER_FONT_PX_MAX}
              step={1}
              value={readerFontPx}
              onChange={(e) => setReaderFontPx(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{readerFontPx}px</p>

            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="outline-font">
              "On this page" font size
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Controls text size of the chapter outline sidebar ({OUTLINE_FONT_PX_MIN}–{OUTLINE_FONT_PX_MAX}px). Smaller
              values fit more headings on screen without scrolling.
            </p>
            <input
              id="outline-font"
              type="range"
              min={OUTLINE_FONT_PX_MIN}
              max={OUTLINE_FONT_PX_MAX}
              step={1}
              value={outlineFontPx}
              onChange={(e) => {
                const v = Number(e.target.value);
                setOutlineFontPx(v);
                document.documentElement.style.setProperty('--study-helper-outline-font', `${v}px`);
              }}
              className="mt-2 w-full accent-indigo-600"
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{outlineFontPx}px</p>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Read aloud (text to speech)</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{TTS_CLOUD_NOTE}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              TTS engine
            </p>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{TTS_ENGINE_OPTIONS[0].label}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{TTS_ENGINE_OPTIONS[0].blurb}</p>

            <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-tts-voice">
              Voice
            </label>
            <select
              id="settings-tts-voice"
              className={providerSelectClass}
              value={ttsVoiceUri}
              onChange={(e) => setTtsVoiceUri(e.target.value)}
            >
              <option value="">Default (system chooses)</option>
              {browserVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            {browserVoices.length === 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                No voices listed yet—wait a moment, or try Chrome/Edge on desktop for the largest catalog.
              </p>
            )}
          </div>

          <label className="mt-6 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-provider">
            Provider
          </label>
          <select
            id="settings-provider"
            className={providerSelectClass}
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as Provider)}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-model">
            Model
          </label>
          {provider === 'custom' ? (
            <input
              id="settings-model"
              className={inputClass}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Full model id for your endpoint"
              autoComplete="off"
            />
          ) : (
            <>
              <select
                id="settings-model-preset"
                className={providerSelectClass}
                value={presetSelectValue}
                onChange={(e) => handlePresetModelChange(e.target.value)}
              >
                {presetModelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {presetSelectValue === OTHER_MODEL_VALUE && (
                <input
                  id="settings-model-custom"
                  className={inputClass}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Enter model id (e.g. from provider docs)"
                  autoComplete="off"
                />
              )}
            </>
          )}

          <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-api-key">
            API Key
          </label>
          {provider === 'gemini' && (
            <div className="mt-1 space-y-1 text-xs text-gray-500 dark:text-gray-500">
              <p>
                Use a key from{' '}
                <a
                  className="text-indigo-600 underline dark:text-indigo-400"
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google AI Studio
                </a>
                . PDF import uses{' '}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">generateContent</code> with{' '}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">inlineData</code> (see{' '}
                <a className="text-indigo-600 underline dark:text-indigo-400" href={GEMINI_DOCS_MULTIMODAL_HREF}>
                  prompting with media
                </a>
                )—the same path for Flash and Pro, even when a model page (e.g. Gemini&nbsp;3) emphasizes text and
                reasoning.
              </p>
              <p>
                Official model ids change over time; pick from the list above, &quot;Other&quot;, or Google&apos;s{' '}
                <a className="text-indigo-600 underline dark:text-indigo-400" href={GEMINI_DOCS_MODELS_HREF}>
                  Gemini models
                </a>{' '}
                reference.
              </p>
            </div>
          )}
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
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              onClick={() => setIsKeyVisible((v) => !v)}
            >
              {isKeyVisible ? 'Hide' : 'Show'}
            </button>
          </div>

          <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-base-url">
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

          <label className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-youtube">
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
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            After you save, use the floating &quot;Music&quot; button (bottom-right) to open Play / Pause and volume.
            If the bar is already open, controls sit at the bottom of the screen.
          </p>

          {statusMessage && <p className="mt-4 text-sm text-green-700 dark:text-green-400">{statusMessage}</p>}
          {errorMessage && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
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
