export type Provider =
  | 'openrouter'
  | 'openai'
  | 'deepseek'
  | 'gemini'
  | 'nvidia'
  | 'anthropic'
  | 'bedrock'
  | 'custom';

export type ThemePreference = 'light' | 'dark';

export type TtsEngine = 'browser';

/** Optional AI profile for a specific app surface (see Settings → Per-task AI). */
export type AiTaskOverrideKey = 'chat' | 'pdfImport';

export interface TaskAiProfile {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey: string;
  /**
   * When `provider` is `bedrock`: optional IAM access key id for SigV4.
   * Leave empty to use `apiKey` as a Bedrock API key (Bearer). Override may omit and use global.
   */
  bedrockAccessKeyId?: string;
  bedrockRegion?: string;
}

export type TaskAiOverrides = Partial<Record<AiTaskOverrideKey, TaskAiProfile>>;

export interface UserSettings {
  userId: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  youtubeUrl?: string;
  theme: ThemePreference;
  /** Base font size (px) for the chapter reader body. */
  readerFontPx: number;
  ttsEngine: TtsEngine;
  ttsVoiceUri: string | null;
  /**
   * When `provider` is `bedrock`: optional IAM access key id for SigV4 signing.
   * If unset, `apiKey` is a Bedrock API key (Bearer, from the Bedrock console).
   */
  bedrockAccessKeyId?: string;
  /** AWS region for the Bedrock Runtime host (default us-east-1). */
  bedrockRegion?: string;
  /** Per-task provider + credentials; omitted keys fall back to the main fields above. */
  taskAiOverrides?: TaskAiOverrides;
}

export interface MasterTopic {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  userId: string;
  masterTopicId: string;
  title: string;
  order: number;
  createdAt: string;
}

export interface Chapter {
  id: string;
  userId: string;
  bookId: string;
  title: string;
  order: number;
  rawContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paragraph {
  id: string;
  userId: string;
  chapterId: string;
  order: number;
  original: string;
  modified: string | null;
  activeVersion: 'original' | 'modified';
  pinnedNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionItem {
  id: string;
  text: string;
  sourceChapter: string;
  sourceBook: string;
}

export interface Extraction {
  id: string;
  userId: string;
  chapterId: string;
  bookId: string;
  type: 'formula' | 'definition' | 'summary' | 'comparison';
  content: ExtractionItem[];
  lastUpdated: string;
}
