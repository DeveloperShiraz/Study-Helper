import { supabase } from './supabase';
import { splitIntoParagraphs } from './chapterParagraphs';

export interface InsertChapterWithParagraphsParams {
  userId: string;
  bookId: string;
  title: string;
  rawMarkdown: string;
  order: number;
}

export type InsertChapterWithParagraphsResult =
  | { ok: true; chapterId: string }
  | { ok: false; error: string };

export async function insertChapterWithParagraphs(
  params: InsertChapterWithParagraphsParams,
): Promise<InsertChapterWithParagraphsResult> {
  const { userId, bookId, title, rawMarkdown, order } = params;

  const { data: chapterRow, error: chapterError } = await supabase
    .from('chapters')
    .insert({
      user_id: userId,
      book_id: bookId,
      title,
      order,
      raw_content: rawMarkdown,
    })
    .select('id')
    .single();

  if (chapterError || !chapterRow) {
    return { ok: false, error: chapterError?.message ?? 'Could not create chapter' };
  }

  const parts = splitIntoParagraphs(rawMarkdown);
  const paragraphRows = parts.map((text, index) => ({
    user_id: userId,
    chapter_id: chapterRow.id,
    order: index,
    original: text,
    modified: null,
    active_version: 'original' as const,
    pinned_note: null,
  }));

  if (paragraphRows.length > 0) {
    const { error: paragraphError } = await supabase.from('paragraphs').insert(paragraphRows);
    if (paragraphError) {
      return { ok: false, error: paragraphError.message };
    }
  }

  return { ok: true, chapterId: chapterRow.id };
}
