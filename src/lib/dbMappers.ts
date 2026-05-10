import type { Book, Chapter, Extraction, ExtractionItem, MasterTopic, Paragraph, UserSettings } from '../types';
import type { Provider } from '../types';

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

export function mapUserSettings(row: UserSettingsRow): UserSettings {
  return {
    userId: row.user_id,
    provider: row.provider as Provider,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    youtubeUrl: row.youtube_url ?? undefined,
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
