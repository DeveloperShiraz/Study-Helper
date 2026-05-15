import type {
  Book,
  Chapter,
  Extraction,
  ExtractionItem,
  MasterTopic,
  Paragraph,
  Provider,
  TaskAiOverrides,
  TaskAiProfile,
  UserSettings,
} from '../types';
import type { ThemePreference, TtsEngine } from '../types';
import { readStoredTheme } from './theme';

export interface MasterTopicRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface BookRow {
  id: string;
  user_id: string;
  master_topic_id: string;
  title: string;
  order: number;
  created_at: string;
}

export interface ChapterRow {
  id: string;
  user_id: string;
  book_id: string;
  title: string;
  order: number;
  raw_content: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParagraphRow {
  id: string;
  user_id: string;
  chapter_id: string;
  order: number;
  original: string;
  modified: string | null;
  active_version: 'original' | 'modified';
  pinned_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
  youtube_url: string | null;
  theme?: string | null;
  reader_font_px?: number | null;
  tts_engine?: string | null;
  tts_voice_uri?: string | null;
  bedrock_access_key_id?: string | null;
  bedrock_region?: string | null;
  task_ai_overrides?: unknown;
}

const KNOWN_PROVIDERS = new Set<Provider>([
  'openrouter',
  'openai',
  'deepseek',
  'gemini',
  'nvidia',
  'anthropic',
  'bedrock',
  'custom',
]);

function isProviderString(value: unknown): value is Provider {
  return typeof value === 'string' && KNOWN_PROVIDERS.has(value as Provider);
}

function isTaskAiProfileJson(value: unknown): value is TaskAiProfile {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (!isProviderString(o.provider)) return false;
  if (typeof o.baseUrl !== 'string' || typeof o.model !== 'string' || typeof o.apiKey !== 'string') return false;
  if (o.bedrockAccessKeyId !== undefined && typeof o.bedrockAccessKeyId !== 'string') return false;
  if (o.bedrockRegion !== undefined && typeof o.bedrockRegion !== 'string') return false;
  return true;
}

function parseTaskAiOverrides(raw: unknown): TaskAiOverrides | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: TaskAiOverrides = {};
  const chat = o.chat;
  if (isTaskAiProfileJson(chat)) {
    out.chat = chat;
  }
  const pdfImport = o.pdfImport;
  if (isTaskAiProfileJson(pdfImport)) {
    out.pdfImport = pdfImport;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export interface ExtractionRow {
  id: string;
  user_id: string;
  chapter_id: string;
  book_id: string;
  type: Extraction['type'];
  content: unknown;
  last_updated: string;
}

export function mapMasterTopic(row: MasterTopicRow): MasterTopic {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    userId: row.user_id,
    masterTopicId: row.master_topic_id,
    title: row.title,
    order: row.order,
    createdAt: row.created_at,
  };
}

export function mapChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    title: row.title,
    order: row.order,
    rawContent: row.raw_content ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapParagraph(row: ParagraphRow): Paragraph {
  return {
    id: row.id,
    userId: row.user_id,
    chapterId: row.chapter_id,
    order: row.order,
    original: row.original,
    modified: row.modified,
    activeVersion: row.active_version,
    pinnedNote: row.pinned_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function themeFromSettingsRow(row: UserSettingsRow): ThemePreference {
  if (row.theme === 'dark') return 'dark';
  if (row.theme === 'light') return 'light';
  return readStoredTheme();
}

function ttsEngineFromRow(row: UserSettingsRow): TtsEngine {
  return row.tts_engine === 'browser' ? 'browser' : 'browser';
}

export const READER_FONT_PX_MIN = 12;
export const READER_FONT_PX_MAX = 32;
export const READER_FONT_PX_DEFAULT = 18;

/** Markdown `##` headings (h2): reader base font size + this many pixels. */
export const READER_MARKDOWN_H2_OFFSET_PX = 8;

export const OUTLINE_FONT_PX_MIN = 10;
export const OUTLINE_FONT_PX_MAX = 18;
export const OUTLINE_FONT_PX_DEFAULT = 13;
export const OUTLINE_FONT_LS_KEY = 'study_helper_outline_font_px';

function readerFontPxFromRow(row: UserSettingsRow): number {
  const raw = row.reader_font_px;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return READER_FONT_PX_DEFAULT;
  }
  return Math.min(READER_FONT_PX_MAX, Math.max(READER_FONT_PX_MIN, Math.round(raw)));
}

export function mapUserSettings(row: UserSettingsRow): UserSettings {
  const rawUri = row.tts_voice_uri;
  const ttsVoiceUri =
    typeof rawUri === 'string' && rawUri.trim().length > 0 ? rawUri.trim() : null;
  const bedrockAccessRaw = row.bedrock_access_key_id;
  const bedrockAccessKeyId =
    typeof bedrockAccessRaw === 'string' && bedrockAccessRaw.trim().length > 0
      ? bedrockAccessRaw.trim()
      : undefined;
  const bedrockRegionRaw = row.bedrock_region;
  const bedrockRegion =
    typeof bedrockRegionRaw === 'string' && bedrockRegionRaw.trim().length > 0
      ? bedrockRegionRaw.trim()
      : undefined;

  return {
    userId: row.user_id,
    provider: row.provider as Provider,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    youtubeUrl: row.youtube_url ?? undefined,
    theme: themeFromSettingsRow(row),
    readerFontPx: readerFontPxFromRow(row),
    ttsEngine: ttsEngineFromRow(row),
    ttsVoiceUri,
    bedrockAccessKeyId,
    bedrockRegion,
    taskAiOverrides: parseTaskAiOverrides(row.task_ai_overrides),
  };
}

interface ExtractionItemJson {
  id: string;
  text: string;
  source_chapter: string;
  source_book: string;
}

function isExtractionItemJson(value: unknown): value is ExtractionItemJson {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.text === 'string' &&
    typeof o.source_chapter === 'string' &&
    typeof o.source_book === 'string'
  );
}

export function mapExtraction(row: ExtractionRow): Extraction {
  const raw = row.content;
  const arr = Array.isArray(raw) ? raw : [];
  const content: ExtractionItem[] = arr.filter(isExtractionItemJson).map((item) => ({
    id: item.id,
    text: item.text,
    sourceChapter: item.source_chapter,
    sourceBook: item.source_book,
  }));

  return {
    id: row.id,
    userId: row.user_id,
    chapterId: row.chapter_id,
    bookId: row.book_id,
    type: row.type,
    content,
    lastUpdated: row.last_updated,
  };
}

export function extractionItemsToJson(items: ExtractionItem[]) {
  return items.map((item) => ({
    id: item.id,
    text: item.text,
    source_chapter: item.sourceChapter,
    source_book: item.sourceBook,
  }));
}
