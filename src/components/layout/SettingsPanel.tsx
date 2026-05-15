import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { callAI } from '../../ai/adapter';
import { supabase } from '../../lib/supabase';
import {
  mapUserSettings,
  READER_FONT_PX_DEFAULT,
  READER_FONT_PX_MAX,
  READER_FONT_PX_MIN,
  READER_MARKDOWN_H2_OFFSET_PX,
  OUTLINE_FONT_PX_DEFAULT,
  OUTLINE_FONT_PX_MIN,
  OUTLINE_FONT_PX_MAX,
  OUTLINE_FONT_LS_KEY,
  type UserSettingsRow,
} from '../../lib/dbMappers';
import { resolveAiSettingsForTask } from '../../lib/aiTaskSettings';
import {
  isReaderFontColumnUnavailableError,
  isTaskAiBedrockColumnUnavailableError,
  isThemeColumnUnavailableError,
  isTtsColumnUnavailableError,
} from '../../lib/themePersist';
import { writeLocalTtsVoiceUri, readLocalTtsVoiceUri } from '../../lib/ttsVoiceLocalFallback';
import { OTHER_MODEL_VALUE, PRESET_MODELS_BY_PROVIDER, presetSelectValueForStoredModel } from '../../lib/providerModels';
import { BEDROCK_DEFAULT_REGION, defaultBaseUrlForProvider, PROVIDER_BASE_URLS } from '../../lib/providerUrls';
import { TTS_CLOUD_NOTE, TTS_ENGINE_OPTIONS } from '../../lib/ttsEngines';
import { useApp } from '../../context/AppContext';
import type { Provider, TaskAiOverrides, TaskAiProfile, UserSettings } from '../../types';
import { AiProviderCredentialsFields, syncPresetAndModelForProvider } from './settings/AiProviderCredentialsFields';
import { ThemeToggle } from './ThemeToggle';

const TEST_SYSTEM = 'You are a ping endpoint. Reply with exactly: OK';

const GEMINI_DOCS_MULTIMODAL_HREF = 'https://ai.google.dev/gemini-api/docs/prompting_with_media';
const GEMINI_DOCS_MODELS_HREF = 'https://ai.google.dev/gemini-api/docs/models/gemini';

function describeAiProfileError(
  label: string,
  trimmedModel: string,
  trimmedKey: string,
  trimmedBase: string,
): string | null {
  if (!trimmedModel || !trimmedKey || !trimmedBase) {
    return `${label}: model, credentials, and base URL are required.`;
  }
  return null;
}

function cloneMainProfileIntoTaskOverride(
  main: Pick<UserSettings, 'provider' | 'model' | 'apiKey' | 'baseUrl' | 'bedrockAccessKeyId' | 'bedrockRegion'>,
): TaskAiProfile {
  return {
    provider: main.provider,
    baseUrl: main.baseUrl.trim(),
    model: main.model.trim(),
    apiKey: main.apiKey.trim(),
    bedrockAccessKeyId: main.provider === 'bedrock' ? main.bedrockAccessKeyId?.trim() : undefined,
    bedrockRegion: main.provider === 'bedrock' ? main.bedrockRegion?.trim() || BEDROCK_DEFAULT_REGION : undefined,
  };
}

export function SettingsPanel() {
  const { state, dispatch } = useApp();
  const { user, settings, isSettingsPanelOpen, isFirstLaunch } = state;
  const [provider, setProvider] = useState<Provider>('openrouter');
  const [presetSelectValue, setPresetSelectValue] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_BASE_URLS.openrouter);
  const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState('');
  const [bedrockRegion, setBedrockRegion] = useState(BEDROCK_DEFAULT_REGION);
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
  const [hasChatTaskOverride, setHasChatTaskOverride] = useState(false);
  const [chatOverrideProvider, setChatOverrideProvider] = useState<Provider>('openrouter');
  const [chatOverridePreset, setChatOverridePreset] = useState('');
  const [chatOverrideModel, setChatOverrideModel] = useState('');
  const [chatOverrideApiKey, setChatOverrideApiKey] = useState('');
  const [chatOverrideBaseUrl, setChatOverrideBaseUrl] = useState(PROVIDER_BASE_URLS.openrouter);
  const [chatOverrideBedrockAccessKeyId, setChatOverrideBedrockAccessKeyId] = useState('');
  const [chatOverrideBedrockRegion, setChatOverrideBedrockRegion] = useState(BEDROCK_DEFAULT_REGION);
  const [isChatOverrideKeyVisible, setIsChatOverrideKeyVisible] = useState(false);
  const [hasPdfTaskOverride, setHasPdfTaskOverride] = useState(false);
  const [pdfOverrideProvider, setPdfOverrideProvider] = useState<Provider>('openrouter');
  const [pdfOverridePreset, setPdfOverridePreset] = useState('');
  const [pdfOverrideModel, setPdfOverrideModel] = useState('');
  const [pdfOverrideApiKey, setPdfOverrideApiKey] = useState('');
  const [pdfOverrideBaseUrl, setPdfOverrideBaseUrl] = useState(PROVIDER_BASE_URLS.openrouter);
  const [pdfOverrideBedrockAccessKeyId, setPdfOverrideBedrockAccessKeyId] = useState('');
  const [pdfOverrideBedrockRegion, setPdfOverrideBedrockRegion] = useState(BEDROCK_DEFAULT_REGION);
  const [isPdfOverrideKeyVisible, setIsPdfOverrideKeyVisible] = useState(false);
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
    setBedrockAccessKeyId(settings.bedrockAccessKeyId ?? '');
    setBedrockRegion(settings.bedrockRegion ?? BEDROCK_DEFAULT_REGION);
    setYoutubeUrl(settings.youtubeUrl ?? '');
    setTtsVoiceUri(settings.ttsVoiceUri ?? readLocalTtsVoiceUri() ?? '');
    setReaderFontPx(settings.readerFontPx);

    const chat = settings.taskAiOverrides?.chat;
    setHasChatTaskOverride(Boolean(chat));
    if (chat) {
      setChatOverrideProvider(chat.provider);
      setChatOverrideModel(chat.model);
      setChatOverrideApiKey(chat.apiKey);
      setChatOverrideBaseUrl(chat.baseUrl);
      setChatOverrideBedrockAccessKeyId(chat.bedrockAccessKeyId ?? '');
      setChatOverrideBedrockRegion(chat.bedrockRegion ?? BEDROCK_DEFAULT_REGION);
      setChatOverridePreset(
        chat.provider === 'custom' ? OTHER_MODEL_VALUE : presetSelectValueForStoredModel(chat.provider, chat.model),
      );
    }

    const pdf = settings.taskAiOverrides?.pdfImport;
    setHasPdfTaskOverride(Boolean(pdf));
    if (pdf) {
      setPdfOverrideProvider(pdf.provider);
      setPdfOverrideModel(pdf.model);
      setPdfOverrideApiKey(pdf.apiKey);
      setPdfOverrideBaseUrl(pdf.baseUrl);
      setPdfOverrideBedrockAccessKeyId(pdf.bedrockAccessKeyId ?? '');
      setPdfOverrideBedrockRegion(pdf.bedrockRegion ?? BEDROCK_DEFAULT_REGION);
      setPdfOverridePreset(
        pdf.provider === 'custom' ? OTHER_MODEL_VALUE : presetSelectValueForStoredModel(pdf.provider, pdf.model),
      );
    }
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
    setBaseUrl(defaultBaseUrlForProvider(provider, bedrockRegion));
  }, [provider, bedrockRegion]);

  useEffect(() => {
    if (chatOverrideProvider === 'custom') return;
    setChatOverrideBaseUrl(defaultBaseUrlForProvider(chatOverrideProvider, chatOverrideBedrockRegion));
  }, [chatOverrideProvider, chatOverrideBedrockRegion]);

  useEffect(() => {
    if (pdfOverrideProvider === 'custom') return;
    setPdfOverrideBaseUrl(defaultBaseUrlForProvider(pdfOverrideProvider, pdfOverrideBedrockRegion));
  }, [pdfOverrideProvider, pdfOverrideBedrockRegion]);

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

  const geminiApiKeyHelp: ReactNode = (
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
        )—the same path for Flash and Pro, even when a model page (e.g. Gemini&nbsp;3) emphasizes text and reasoning.
      </p>
      <p>
        Official model ids change over time; pick from the list above, &quot;Other&quot;, or Google&apos;s{' '}
        <a className="text-indigo-600 underline dark:text-indigo-400" href={GEMINI_DOCS_MODELS_HREF}>
          Gemini models
        </a>{' '}
        reference.
      </p>
    </div>
  );

  function buildDraftUserSettings(taskOverrides: TaskAiOverrides | undefined): UserSettings {
    return {
      userId: sessionUser.id,
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim() || 'test',
      theme: state.theme,
      readerFontPx,
      ttsEngine: 'browser',
      ttsVoiceUri: ttsVoiceUri.trim() || null,
      bedrockAccessKeyId: provider === 'bedrock' ? bedrockAccessKeyId.trim() : undefined,
      bedrockRegion: provider === 'bedrock' ? bedrockRegion.trim() || BEDROCK_DEFAULT_REGION : undefined,
      taskAiOverrides: taskOverrides && Object.keys(taskOverrides).length > 0 ? taskOverrides : undefined,
    };
  }

  function buildTaskOverridesFromForm(prev: TaskAiOverrides | undefined): TaskAiOverrides {
    const base: TaskAiOverrides = prev ? { ...prev } : {};
    if (hasChatTaskOverride) {
      base.chat = {
        provider: chatOverrideProvider,
        baseUrl: chatOverrideBaseUrl.trim(),
        model: chatOverrideModel.trim(),
        apiKey: chatOverrideApiKey.trim(),
        bedrockAccessKeyId:
          chatOverrideProvider === 'bedrock' ? chatOverrideBedrockAccessKeyId.trim() || undefined : undefined,
        bedrockRegion:
          chatOverrideProvider === 'bedrock'
            ? chatOverrideBedrockRegion.trim() || BEDROCK_DEFAULT_REGION
            : undefined,
      };
    } else {
      delete base.chat;
    }
    if (hasPdfTaskOverride) {
      base.pdfImport = {
        provider: pdfOverrideProvider,
        baseUrl: pdfOverrideBaseUrl.trim(),
        model: pdfOverrideModel.trim(),
        apiKey: pdfOverrideApiKey.trim(),
        bedrockAccessKeyId:
          pdfOverrideProvider === 'bedrock' ? pdfOverrideBedrockAccessKeyId.trim() || undefined : undefined,
        bedrockRegion:
          pdfOverrideProvider === 'bedrock' ? pdfOverrideBedrockRegion.trim() || BEDROCK_DEFAULT_REGION : undefined,
      };
    } else {
      delete base.pdfImport;
    }
    return base;
  }

  async function handleTestConnection() {
    setIsTesting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    const taskOverrides = buildTaskOverridesFromForm(settings?.taskAiOverrides);
    const draft = buildDraftUserSettings(taskOverrides);
    try {
      await callAI('Reply with OK only.', TEST_SYSTEM, resolveAiSettingsForTask(draft, 'chat'));
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
    const trimmedBedrockAccess = bedrockAccessKeyId.trim();

    const mainErr = describeAiProfileError('Main AI profile', trimmedModel, trimmedKey, trimmedBase);
    if (mainErr) {
      setErrorMessage(mainErr);
      setIsSaving(false);
      return;
    }

    const taskOverrides = buildTaskOverridesFromForm(settings?.taskAiOverrides);

    if (hasChatTaskOverride) {
      const err = describeAiProfileError(
        'Chat / tools override',
        chatOverrideModel.trim(),
        chatOverrideApiKey.trim(),
        chatOverrideBaseUrl.trim(),
      );
      if (err) {
        setErrorMessage(err);
        setIsSaving(false);
        return;
      }
    }

    if (hasPdfTaskOverride) {
      const err = describeAiProfileError(
        'PDF import override',
        pdfOverrideModel.trim(),
        pdfOverrideApiKey.trim(),
        pdfOverrideBaseUrl.trim(),
      );
      if (err) {
        setErrorMessage(err);
        setIsSaving(false);
        return;
      }
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
      bedrock_access_key_id: provider === 'bedrock' ? trimmedBedrockAccess : null,
      bedrock_region: provider === 'bedrock' ? bedrockRegion.trim() || BEDROCK_DEFAULT_REGION : null,
      task_ai_overrides: taskOverrides,
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

    if (upsertError && isTaskAiBedrockColumnUnavailableError(upsertError.message)) {
      delete current.task_ai_overrides;
      delete current.bedrock_access_key_id;
      delete current.bedrock_region;
      upsertError = (
        await supabase.from('user_settings').upsert(current as never, { onConflict: 'user_id' })
      ).error;
      if (!upsertError) {
        fallbackNotes.push(
          'Per-task AI and Bedrock columns were skipped (missing migration or stale PostgREST cache). Apply supabase/migrations/006_user_settings_task_ai_bedrock.sql and run NOTIFY pgrst, \'reload schema\'; in the SQL editor.',
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
    } catch {
      /* ignore quota / private mode */
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

  function handleMainProviderChange(nextProvider: Provider) {
    setProvider(nextProvider);
    const { presetSelectValue: nextPreset, model: nextModel } = syncPresetAndModelForProvider(nextProvider, model);
    setPresetSelectValue(nextPreset);
    setModel(nextModel);
  }

  function handleMainPresetModelChange(value: string) {
    setPresetSelectValue(value);
    if (value !== OTHER_MODEL_VALUE) {
      setModel(value);
    }
  }

  function handleChatOverrideProviderChange(nextProvider: Provider) {
    setChatOverrideProvider(nextProvider);
    const { presetSelectValue: nextPreset, model: nextModel } = syncPresetAndModelForProvider(
      nextProvider,
      chatOverrideModel,
    );
    setChatOverridePreset(nextPreset);
    setChatOverrideModel(nextModel);
  }

  function handleChatOverridePresetChange(value: string) {
    setChatOverridePreset(value);
    if (value !== OTHER_MODEL_VALUE) {
      setChatOverrideModel(value);
    }
  }

  function handlePdfOverrideProviderChange(nextProvider: Provider) {
    setPdfOverrideProvider(nextProvider);
    const { presetSelectValue: nextPreset, model: nextModel } = syncPresetAndModelForProvider(
      nextProvider,
      pdfOverrideModel,
    );
    setPdfOverridePreset(nextPreset);
    setPdfOverrideModel(nextModel);
  }

  function handlePdfOverridePresetChange(value: string) {
    setPdfOverridePreset(value);
    if (value !== OTHER_MODEL_VALUE) {
      setPdfOverrideModel(value);
    }
  }

  function copyMainIntoChatOverride() {
    const next = cloneMainProfileIntoTaskOverride({
      provider,
      model,
      apiKey,
      baseUrl,
      bedrockAccessKeyId,
      bedrockRegion,
    });
    setChatOverrideProvider(next.provider);
    setChatOverrideModel(next.model);
    setChatOverrideApiKey(next.apiKey);
    setChatOverrideBaseUrl(next.baseUrl);
    setChatOverrideBedrockAccessKeyId(next.bedrockAccessKeyId ?? '');
    setChatOverrideBedrockRegion(next.bedrockRegion ?? BEDROCK_DEFAULT_REGION);
    setChatOverridePreset(
      next.provider === 'custom' ? OTHER_MODEL_VALUE : presetSelectValueForStoredModel(next.provider, next.model),
    );
  }

  function copyMainIntoPdfOverride() {
    const next = cloneMainProfileIntoTaskOverride({
      provider,
      model,
      apiKey,
      baseUrl,
      bedrockAccessKeyId,
      bedrockRegion,
    });
    setPdfOverrideProvider(next.provider);
    setPdfOverrideModel(next.model);
    setPdfOverrideApiKey(next.apiKey);
    setPdfOverrideBaseUrl(next.baseUrl);
    setPdfOverrideBedrockAccessKeyId(next.bedrockAccessKeyId ?? '');
    setPdfOverrideBedrockRegion(next.bedrockRegion ?? BEDROCK_DEFAULT_REGION);
    setPdfOverridePreset(
      next.provider === 'custom' ? OTHER_MODEL_VALUE : presetSelectValueForStoredModel(next.provider, next.model),
    );
  }

  const providerSelectClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

  const checkboxLabelClass = 'mt-2 flex cursor-pointer items-start gap-2 text-sm text-gray-700 dark:text-gray-300';

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

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Default AI profile</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Used everywhere unless you enable a per-task override below. Test connection uses the effective chat
              profile (default or chat override).
            </p>
            <AiProviderCredentialsFields
              idPrefix="settings-main"
              provider={provider}
              onProviderChange={handleMainProviderChange}
              presetSelectValue={presetSelectValue}
              onPresetModelChange={handleMainPresetModelChange}
              model={model}
              onModelChange={setModel}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              isKeyVisible={isKeyVisible}
              onToggleKeyVisible={() => setIsKeyVisible((v) => !v)}
              bedrockAccessKeyId={bedrockAccessKeyId}
              onBedrockAccessKeyIdChange={setBedrockAccessKeyId}
              bedrockRegion={bedrockRegion}
              onBedrockRegionChange={setBedrockRegion}
              baseUrl={baseUrl}
              onBaseUrlChange={setBaseUrl}
              providerSelectClass={providerSelectClass}
              inputClass={inputClass}
              geminiHelp={geminiApiKeyHelp}
            />
            {provider === 'bedrock' && (
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                Default auth is a Bedrock API key (Bearer), from the Bedrock console. Set region to match that console.
                Optional IAM access key + secret still works (SigV4) if you fill the IAM access key ID field. Newer Claude
                models usually need an inference profile id (e.g. us.anthropic.claude-sonnet-4-6), not only the base
                anthropic.* id, for on-demand calls—see the Model list. If you still enter a bare foundation id for a
                supported Claude 4.x model, the app maps it to a cross-region profile from your Region.
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Per-task AI</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional separate providers for chat-style tools vs PDF-derived text. Omitting an override uses the
              default profile above.
            </p>

            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                className="mt-1"
                checked={hasChatTaskOverride}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasChatTaskOverride(checked);
                  if (checked) {
                    copyMainIntoChatOverride();
                  }
                }}
              />
              <span>
                Custom profile for <span className="font-medium">chat &amp; tools</span> (Explain, Simplify,
                extractions, …)
              </span>
            </label>
            {hasChatTaskOverride && (
              <div className="mt-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 underline dark:text-indigo-400"
                  onClick={copyMainIntoChatOverride}
                >
                  Copy from default profile
                </button>
                <AiProviderCredentialsFields
                  idPrefix="settings-chat-override"
                  provider={chatOverrideProvider}
                  onProviderChange={handleChatOverrideProviderChange}
                  presetSelectValue={chatOverridePreset}
                  onPresetModelChange={handleChatOverridePresetChange}
                  model={chatOverrideModel}
                  onModelChange={setChatOverrideModel}
                  apiKey={chatOverrideApiKey}
                  onApiKeyChange={setChatOverrideApiKey}
                  isKeyVisible={isChatOverrideKeyVisible}
                  onToggleKeyVisible={() => setIsChatOverrideKeyVisible((v) => !v)}
                  bedrockAccessKeyId={chatOverrideBedrockAccessKeyId}
                  onBedrockAccessKeyIdChange={setChatOverrideBedrockAccessKeyId}
                  bedrockRegion={chatOverrideBedrockRegion}
                  onBedrockRegionChange={setChatOverrideBedrockRegion}
                  baseUrl={chatOverrideBaseUrl}
                  onBaseUrlChange={setChatOverrideBaseUrl}
                  providerSelectClass={providerSelectClass}
                  inputClass={inputClass}
                  geminiHelp={geminiApiKeyHelp}
                />
              </div>
            )}

            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                className="mt-1"
                checked={hasPdfTaskOverride}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasPdfTaskOverride(checked);
                  if (checked) {
                    copyMainIntoPdfOverride();
                  }
                }}
              />
              <span>
                Custom profile for <span className="font-medium">PDF import</span> (segment structuring and single-PDF
                extract in Add chapter)
              </span>
            </label>
            {hasPdfTaskOverride && (
              <div className="mt-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 underline dark:text-indigo-400"
                  onClick={copyMainIntoPdfOverride}
                >
                  Copy from default profile
                </button>
                <AiProviderCredentialsFields
                  idPrefix="settings-pdf-override"
                  provider={pdfOverrideProvider}
                  onProviderChange={handlePdfOverrideProviderChange}
                  presetSelectValue={pdfOverridePreset}
                  onPresetModelChange={handlePdfOverridePresetChange}
                  model={pdfOverrideModel}
                  onModelChange={setPdfOverrideModel}
                  apiKey={pdfOverrideApiKey}
                  onApiKeyChange={setPdfOverrideApiKey}
                  isKeyVisible={isPdfOverrideKeyVisible}
                  onToggleKeyVisible={() => setIsPdfOverrideKeyVisible((v) => !v)}
                  bedrockAccessKeyId={pdfOverrideBedrockAccessKeyId}
                  onBedrockAccessKeyIdChange={setPdfOverrideBedrockAccessKeyId}
                  bedrockRegion={pdfOverrideBedrockRegion}
                  onBedrockRegionChange={setPdfOverrideBedrockRegion}
                  baseUrl={pdfOverrideBaseUrl}
                  onBaseUrlChange={setPdfOverrideBaseUrl}
                  providerSelectClass={providerSelectClass}
                  inputClass={inputClass}
                  geminiHelp={geminiApiKeyHelp}
                />
              </div>
            )}
          </div>

          <label className="mt-6 text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="settings-youtube">
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
