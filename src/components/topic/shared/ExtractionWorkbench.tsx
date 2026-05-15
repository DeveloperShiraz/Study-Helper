import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';
import { mapBook, mapChapter, mapExtraction, extractionItemsToJson, type BookRow, type ChapterRow, type ExtractionRow } from '../../../lib/dbMappers';
import { getVisibleExtractionTexts, hasVisibleExtractionContent } from '../../../lib/extractionVisibility';
import { formatDefinitionInline } from '../../../lib/definitionFormat';
import { useApp } from '../../../context/AppContext';
import { useAI } from '../../../hooks/useAI';
import { MarkdownWithMath } from '../../reader/MarkdownWithMath';
import type { Book, Chapter, Extraction, ExtractionItem, UserSettings } from '../../../types';

const EXTRACTION_SAVED_NOTE =
  'When extraction finishes without errors, results are written to the extractions table in Supabase (per chapter and type).';

const CHAPTER_ROW_LABEL_CLASS =
  'flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200';
const CHAPTER_ROW_CHECKBOX_CLASS = 'mt-1 shrink-0';
const CHAPTER_TITLE_WRAP_CLASS =
  'flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2';
const CHAPTER_EMPTY_HINT_CLASS = 'text-xs font-normal italic text-gray-500 dark:text-gray-400';

const NO_VISIBLE_EXTRACTIONS_HINT =
  'No saved extraction content to show below. Extract or refresh chapters until the model returns lines to keep.';

const READER_MATCH_GRID_CLASS =
  'flex flex-col gap-4 lg:grid lg:grid-cols-[min(22rem,100%)_1fr] lg:items-start lg:gap-4';

const EXTRACTION_ASIDE_CLASS =
  'order-2 rounded-xl border border-amber-100/80 bg-[#faf8f4] p-3 shadow-sm dark:border-stone-700/60 dark:bg-[#1e1c18] lg:sticky lg:top-20 lg:order-1 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto';

const EXTRACTION_ASIDE_FONT_STYLE: CSSProperties = {
  fontSize: 'var(--study-helper-outline-font, 12px)',
  fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
};

const EXTRACTION_MAIN_CLASS = 'order-1 min-w-0 lg:order-2';

const EXTRACTION_ARTICLE_CLASS =
  'mt-4 space-y-4 rounded-2xl border border-amber-100/80 bg-[#faf8f4] p-4 shadow-md sm:p-6 dark:border-stone-700/60 dark:bg-[#1e1c18]';

const EXTRACTION_ARTICLE_FONT_STYLE: CSSProperties = {
  fontSize: 'var(--study-helper-reader-font, 18px)',
  fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
  lineHeight: 1.8,
};

const OUTLINE_NAV_EYEBROW_CLASS =
  'mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700/80 dark:text-amber-500/80';

const OUTLINE_NAV_MARK_CLASS = 'inline-block h-3 w-0.5 rounded-full bg-amber-400/70 dark:bg-amber-500/60';

const EXTRACTION_BOOK_LABEL_CLASS =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-400/90';

const EXTRACTION_SELECT_CLASS =
  'mt-0.5 block w-full rounded-lg border border-amber-200/90 bg-white/95 px-2 py-1.5 text-sm text-stone-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-950/80 dark:text-stone-100';

const EXTRACTION_CHAPTER_TOOLBAR_CLASS = 'mb-2 flex flex-wrap items-center gap-x-3 gap-y-1';

const EXTRACTION_PRIMARY_BTN_CLASS =
  'w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

const EXTRACTION_SECONDARY_BTN_CLASS =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800';

const EXTRACTION_SAVED_NOTE_IN_ASIDE_CLASS =
  'mt-3 text-[11px] leading-snug text-stone-600 dark:text-stone-400';

const EXTRACTION_ASIDE_DIVIDER_CLASS = 'mt-3 flex flex-col gap-2 border-t border-amber-200/60 pt-3 dark:border-stone-600/60';

const EXTRACTION_RESULT_CARD_CLASS =
  'rounded-xl border border-amber-100/90 bg-white/80 p-3 shadow-sm dark:border-stone-600/80 dark:bg-stone-900/50';

const EXTRACTION_MARKDOWN_BODY_CLASS =
  'extraction-markdown-body mt-2 text-stone-800 dark:text-stone-100 [&_p]:my-2 [&_p]:leading-relaxed [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:leading-relaxed [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-amber-100/90 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] dark:[&_code]:bg-stone-800';

const EXTRACTION_UPDATE_BTN_CLASS =
  'shrink-0 rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-white disabled:opacity-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-900';

const EXTRACTION_READER_LINK_CLASS =
  'shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/60';

interface ExtractionWorkbenchProps {
  topicId: string;
  extractionType: Extraction['type'];
  heading: string;
  buildExistingPrompt: (items: ExtractionItem[]) => string;
  mapResponseToItems: (raw: string, sourceChapter: string, sourceBook: string) => ExtractionItem[];
}

export function ExtractionWorkbench({
  topicId,
  extractionType,
  heading,
  buildExistingPrompt,
  mapResponseToItems,
}: ExtractionWorkbenchProps) {
  const { state } = useApp();
  const { extractFormulas, extractDefinitions, extractComparisons, summarize, isLoading, error } = useAI();
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    if (!state.user) return;
    const { data } = await supabase
      .from('books')
      .select('*')
      .eq('master_topic_id', topicId)
      .eq('user_id', state.user.id)
      .order('order', { ascending: true });
    const mapped = (data ?? []).map((row) => mapBook(row as BookRow));
    setBooks(mapped);
    setSelectedBookId((prev) => {
      if (mapped.length === 0) return '';
      if (prev && mapped.some((b) => b.id === prev)) return prev;
      return mapped[0].id;
    });
  }, [state.user, topicId]);

  const loadChapters = useCallback(async () => {
    if (!state.user || !selectedBookId) {
      setChapters([]);
      return;
    }
    const { data } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', selectedBookId)
      .eq('user_id', state.user.id)
      .order('order', { ascending: true });
    setChapters((data ?? []).map((row) => mapChapter(row as ChapterRow)));
  }, [state.user, selectedBookId]);

  const loadExtractions = useCallback(async () => {
    if (!state.user || !selectedBookId) {
      setExtractions([]);
      return;
    }
    const { data } = await supabase
      .from('extractions')
      .select('*')
      .eq('book_id', selectedBookId)
      .eq('user_id', state.user.id)
      .eq('type', extractionType);
    setExtractions((data ?? []).map((row) => mapExtraction(row as ExtractionRow)));
  }, [state.user, selectedBookId, extractionType]);

  useEffect(() => {
    setSelectedChapterIds([]);
  }, [topicId]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  useEffect(() => {
    loadExtractions();
  }, [loadExtractions]);

  function toggleChapter(id: string) {
    setSelectedChapterIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function getChapterSourceText(chapter: Chapter): Promise<string> {
    const raw = chapter.rawContent?.trim() ?? '';
    if (raw) return raw;
    if (!state.user) return '';

    const { data } = await supabase
      .from('paragraphs')
      .select('original, order')
      .eq('chapter_id', chapter.id)
      .eq('user_id', state.user.id)
      .order('order', { ascending: true });

    return (data ?? [])
      .map((row) => (row as { original: string }).original.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  async function runExtractionForChapter(chapter: Chapter, settings: UserSettings, book: Book) {
    const source = (await getChapterSourceText(chapter)).trim();
    if (!source) {
      setStatus(`Chapter "${chapter.title}" has no content.`);
      return;
    }

    let existingList = '';
    if (extractionType === 'formula') {
      const { data: existingRow } = await supabase
        .from('extractions')
        .select('*')
        .eq('chapter_id', chapter.id)
        .eq('type', extractionType)
        .eq('user_id', state.user!.id)
        .maybeSingle();
      if (existingRow) {
        existingList = buildExistingPrompt(mapExtraction(existingRow as ExtractionRow).content);
      }
    }

    let raw = '';
    if (extractionType === 'formula') {
      raw = await extractFormulas(source, existingList, settings);
    } else if (extractionType === 'definition') {
      raw = await extractDefinitions(source, settings);
    } else if (extractionType === 'comparison') {
      raw = await extractComparisons(source, settings);
    } else {
      raw = await summarize(source, settings);
    }

    const items = mapResponseToItems(raw, chapter.title, book.title);
    const payload = {
      user_id: state.user!.id,
      chapter_id: chapter.id,
      book_id: book.id,
      type: extractionType,
      content: extractionItemsToJson(items),
      last_updated: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase.from('extractions').upsert(payload, {
      onConflict: 'chapter_id,type',
    });

    if (upsertError) {
      setStatus(upsertError.message);
      return;
    }

    await loadExtractions();
    setStatus(`Updated ${chapter.title}.`);
  }

  async function handleExtractAll() {
    if (!state.settings || !state.user) {
      setStatus('Configure AI settings first.');
      return;
    }
    const book = books.find((b) => b.id === selectedBookId);
    if (!book) {
      setStatus('Select a book.');
      return;
    }
    const targets = chapters.filter((c) => selectedChapterIds.includes(c.id));
    if (targets.length === 0) {
      setStatus('Select at least one chapter.');
      return;
    }

    setStatus(null);
    for (const chapter of targets) {
      try {
        await runExtractionForChapter(chapter, state.settings, book);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : 'Extraction failed');
        return;
      }
    }
  }

  const book = books.find((b) => b.id === selectedBookId);
  const extractionByChapter = new Map(extractions.map((e) => [e.chapterId, e]));

  const visibleExtractionChapterCount = useMemo(() => {
    const byChapter = new Map(extractions.map((e) => [e.chapterId, e]));
    return chapters.reduce((n, ch) => {
      return n + (hasVisibleExtractionContent(byChapter.get(ch.id)) ? 1 : 0);
    }, 0);
  }, [chapters, extractions]);

  function handleSelectAllChapters() {
    setSelectedChapterIds(chapters.map((c) => c.id));
  }

  function handleClearChapterSelection() {
    setSelectedChapterIds([]);
  }

  async function handleRefreshAllWithSavedExtractions() {
    if (!state.settings || !state.user) {
      setStatus('Configure AI settings first.');
      return;
    }
    if (!book) {
      setStatus('Select a book.');
      return;
    }
    const targets = chapters.filter((c) => extractionByChapter.has(c.id));
    if (targets.length === 0) {
      setStatus('No saved extractions for this book yet. Run extract on at least one chapter first.');
      return;
    }

    setStatus(null);
    for (const chapter of targets) {
      try {
        await runExtractionForChapter(chapter, state.settings, book);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : 'Extraction failed');
        return;
      }
    }
  }

  if (books.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Add a book in the Books tab before running extractions.</p>
      </div>
    );
  }

  return (
    <div className={READER_MATCH_GRID_CLASS}>
      <aside className={EXTRACTION_ASIDE_CLASS} style={EXTRACTION_ASIDE_FONT_STYLE}>
        <nav aria-label="Extraction chapters">
          <p className={OUTLINE_NAV_EYEBROW_CLASS}>
            <span className={OUTLINE_NAV_MARK_CLASS} aria-hidden="true" />
            Chapters
          </p>

          <div className="mb-3">
            <label className={EXTRACTION_BOOK_LABEL_CLASS} htmlFor="extraction-book">
              Book
            </label>
            <select
              id="extraction-book"
              className={EXTRACTION_SELECT_CLASS}
              value={selectedBookId}
              onChange={(e) => {
                setSelectedBookId(e.target.value);
                setSelectedChapterIds([]);
              }}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-1">
            <div className={EXTRACTION_CHAPTER_TOOLBAR_CLASS}>
              <p className="text-[12px] font-medium text-stone-700 dark:text-stone-300">Select</p>
              {chapters.length > 0 && (
                <>
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-400"
                    onClick={handleSelectAllChapters}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-stone-600 hover:underline dark:text-stone-400"
                    onClick={handleClearChapterSelection}
                  >
                    Clear selection
                  </button>
                </>
              )}
            </div>
            <div className="mt-2 space-y-2">
              {chapters.map((chapter) => {
                const isChecked = selectedChapterIds.includes(chapter.id);
                const extraction = extractionByChapter.get(chapter.id);
                const hasVisible = hasVisibleExtractionContent(extraction);
                return (
                  <label key={chapter.id} className={CHAPTER_ROW_LABEL_CLASS}>
                    <input
                      type="checkbox"
                      className={CHAPTER_ROW_CHECKBOX_CLASS}
                      checked={isChecked}
                      onChange={() => toggleChapter(chapter.id)}
                    />
                    <span className={CHAPTER_TITLE_WRAP_CLASS}>
                      <span className="min-w-0">{chapter.title}</span>
                      {!hasVisible ? (
                        <span className={CHAPTER_EMPTY_HINT_CLASS}>Nothing to show for this chapter</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {chapters.length === 0 && (
                <p className="text-sm text-stone-500 dark:text-stone-400">No chapters in this book.</p>
              )}
            </div>
          </div>

          <div className={EXTRACTION_ASIDE_DIVIDER_CLASS}>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleExtractAll}
              className={EXTRACTION_PRIMARY_BTN_CLASS}
            >
              Extract for selected chapters
            </button>
            <button
              type="button"
              disabled={isLoading || chapters.length === 0}
              onClick={handleRefreshAllWithSavedExtractions}
              className={EXTRACTION_SECONDARY_BTN_CLASS}
            >
              Refresh all saved extractions
            </button>
          </div>

          <p className={EXTRACTION_SAVED_NOTE_IN_ASIDE_CLASS}>{EXTRACTION_SAVED_NOTE}</p>

          {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          {status ? <p className="mt-2 text-sm text-stone-800 dark:text-stone-200">{status}</p> : null}
        </nav>
      </aside>

      <div className={EXTRACTION_MAIN_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{heading}</p>
            <h1 className="break-words text-xl font-semibold text-gray-900 dark:text-gray-100">
              {book?.title ?? 'Book'}
            </h1>
          </div>
          {selectedBookId ? (
            <Link
              to={`/topic/${topicId}/book/${selectedBookId}/extract/${extractionType}`}
              className={EXTRACTION_READER_LINK_CLASS}
            >
              Open reader layout
            </Link>
          ) : null}
        </div>

        <article className={EXTRACTION_ARTICLE_CLASS} style={EXTRACTION_ARTICLE_FONT_STYLE}>
          {book && visibleExtractionChapterCount === 0 && chapters.length > 0 ? (
            <p className="text-sm text-stone-600 dark:text-stone-300">{NO_VISIBLE_EXTRACTIONS_HINT}</p>
          ) : null}
          {book &&
            chapters.map((chapter) => {
              const extraction = extractionByChapter.get(chapter.id);
              const visibleTexts = getVisibleExtractionTexts(extraction);
              if (visibleTexts.length === 0) return null;
              return (
                <div key={chapter.id} className={EXTRACTION_RESULT_CARD_CLASS}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {book.title} — {chapter.title}
                    </h3>
                    <button
                      type="button"
                      disabled={isLoading || !state.settings}
                      className={EXTRACTION_UPDATE_BTN_CLASS}
                      onClick={async () => {
                        if (!state.settings) return;
                        try {
                          await runExtractionForChapter(chapter, state.settings, book);
                        } catch (e) {
                          setStatus(e instanceof Error ? e.message : 'Update failed');
                        }
                      }}
                    >
                      Update
                    </button>
                  </div>
                  <div className={EXTRACTION_MARKDOWN_BODY_CLASS}>
                    <MarkdownWithMath>
                      {(extractionType === 'definition' ? visibleTexts.map(formatDefinitionInline) : visibleTexts).join('\n\n')}
                    </MarkdownWithMath>
                  </div>
                </div>
              );
            })}
        </article>
      </div>
    </div>
  );
}

function mapLinesToItems(raw: string, sourceChapter: string, sourceBook: string): ExtractionItem[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id: uuidv4(),
      text,
      sourceChapter,
      sourceBook,
    }));
}

function mapBlocksToItems(raw: string, sourceChapter: string, sourceBook: string): ExtractionItem[] {
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((text) => ({
      id: uuidv4(),
      text,
      sourceChapter,
      sourceBook,
    }));
}

export const extractionHelpers = {
  formulasExistingList(items: ExtractionItem[]) {
    return items.map((i) => i.text).join('\n');
  },
  mapFormulaLines: mapLinesToItems,
  mapDefinitionBlocks: mapBlocksToItems,
  mapComparisonBlocks: mapBlocksToItems,
  mapSummaryLines: mapLinesToItems,
};
