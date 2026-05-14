import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';
import { mapBook, mapChapter, mapExtraction, extractionItemsToJson, type BookRow, type ChapterRow, type ExtractionRow } from '../../../lib/dbMappers';
import { useApp } from '../../../context/AppContext';
import { useAI } from '../../../hooks/useAI';
import type { Book, Chapter, Extraction, ExtractionItem, UserSettings } from '../../../types';

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

  const selectClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100';

  if (books.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Add a book in the Books tab before running extractions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="extraction-book">
          Book
        </label>
        <select
          id="extraction-book"
          className={selectClass}
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

      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Chapters</p>
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
                className="text-xs font-medium text-gray-600 hover:underline dark:text-gray-400"
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
            return (
              <label key={chapter.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChapter(chapter.id)}
                />
                {chapter.title}
              </label>
            );
          })}
          {chapters.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No chapters in this book.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleExtractAll}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Extract for selected chapters
        </button>
        <button
          type="button"
          disabled={isLoading || chapters.length === 0}
          onClick={handleRefreshAllWithSavedExtractions}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          Refresh all saved extractions
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {status && <p className="text-sm text-gray-700 dark:text-gray-300">{status}</p>}

      <div className="space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
        {book &&
          chapters.map((chapter) => {
            const extraction = extractionByChapter.get(chapter.id);
            if (!extraction || extraction.content.length === 0) return null;
            return (
              <div key={chapter.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {book.title} — {chapter.title}
                  </h3>
                  <button
                    type="button"
                    disabled={isLoading || !state.settings}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-white disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
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
                <div className="mt-2 space-y-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                  {extraction.content.map((item) => (
                    <p key={item.id}>{item.text}</p>
                  ))}
                </div>
              </div>
            );
          })}
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
