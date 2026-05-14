export type Provider =
  | 'openrouter'
  | 'openai'
  | 'deepseek'
  | 'gemini'
  | 'nvidia'
  | 'anthropic'
  | 'custom';

export type ThemePreference = 'light' | 'dark';

export type TtsEngine = 'browser';

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
