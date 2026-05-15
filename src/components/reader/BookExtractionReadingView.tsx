import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapBook, mapChapter, mapExtraction, type BookRow, type ChapterRow, type ExtractionRow } from '../../lib/dbMappers';
import { getVisibleExtractionItems, hasVisibleExtractionContent } from '../../lib/extractionVisibility';
import { readExtractionPinsJson, parseExtractionPins, writeExtractionPins } from '../../lib/extractionLocalPins';
import { speakPlainText } from '../../lib/speakPlainText';
import { formatDefinitionInline } from '../../lib/definitionFormat';
import { extractionChapterSectionId } from '../../lib/extractionReaderDom';
import { useApp } from '../../context/AppContext';
import { useAI } from '../../hooks/useAI';
import type { Book, Chapter, Extraction } from '../../types';
import AppHeader from '../layout/AppHeader';
import { AuthenticatedSessionFallback } from '../layout/AuthenticatedSessionFallback';
import { ExtractionChapterOutlineNav } from './ExtractionChapterOutlineNav';
import { ExtractionLineStudyBlock } from './ExtractionLineStudyBlock';
import { ExplainPopup } from './ExplainPopup';
import { SimplifySourcePopup } from './SimplifySourcePopup';
import { PinNotePopup } from './PinNotePopup';

const EXTRACTION_ROUTE_TYPES = ['formula', 'definition', 'comparison', 'summary'] as const;

const EXTRACTION_HEADING_BY_TYPE: Record<(typeof EXTRACTION_ROUTE_TYPES)[number], string> = {
  formula: 'Formulas',
  definition: 'Definitions',
  comparison: 'Comparisons',
  summary: 'Summaries',
};

const READER_GRID_CLASS = 'flex flex-col gap-4 lg:grid lg:grid-cols-[auto_1fr] lg:gap-4';

const READER_ARTICLE_CLASS =
  'mt-8 space-y-2 rounded-2xl border border-amber-100/80 bg-[#faf8f4] p-6 shadow-md sm:p-8 dark:border-stone-700/60 dark:bg-[#1e1c18]';

const READER_ARTICLE_STYLE = {
  fontSize: 'var(--study-helper-reader-font, 18px)',
  fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
  lineHeight: '1.8',
} as const;

const CHAPTER_SECTION_TITLE_CLASS =
  'scroll-mt-24 text-lg font-semibold text-stone-900 dark:text-stone-100';

const CHAPTER_EMPTY_CLASS = 'text-sm text-stone-600 dark:text-stone-300';

const SETTINGS_BTN_CLASS =
  'flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

const settingsGearIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

type ExtractionReaderPopup =
  | { kind: 'explain'; itemId: string; sourceText: string; explanation: string }
  | { kind: 'simplify'; sourceText: string }
  | { kind: 'pin'; itemId: string; initialNote: string };

function parseExtractionRouteType(raw: string | undefined): Extraction['type'] | null {
  if (!raw) {
    return null;
  }
  return (EXTRACTION_ROUTE_TYPES as readonly string[]).includes(raw) ? (raw as Extraction['type']) : null;
}

export function BookExtractionReadingView() {
  const { topicId, bookId, extractionType: extractionTypeParam } = useParams<{
    topicId: string;
    bookId: string;
    extractionType: string;
  }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { explain, isLoading: isExplainLoading, error: explainError } = useAI();

  const extractionType = parseExtractionRouteType(extractionTypeParam);

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [pinsByItemId, setPinsByItemId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [popup, setPopup] = useState<ExtractionReaderPopup | null>(null);

  const loadPins = useCallback(() => {
    if (!state.user || !bookId || !extractionType) {
      setPinsByItemId({});
      return;
    }
    const raw = readExtractionPinsJson(state.user.id, bookId, extractionType);
    setPinsByItemId(parseExtractionPins(raw));
  }, [state.user, bookId, extractionType]);

  const loadAll = useCallback(async () => {
    if (!state.user || !topicId || !bookId || !extractionType) {
      setBook(null);
      setChapters([]);
      setExtractions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: bookRow, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (bookError || !bookRow) {
      navigate(`/topic/${topicId}`, { replace: true });
      setIsLoading(false);
      return;
    }

    const mappedBook = mapBook(bookRow as BookRow);
    if (mappedBook.masterTopicId !== topicId) {
      navigate(`/topic/${topicId}`, { replace: true });
      setIsLoading(false);
      return;
    }

    const { data: chapterRows } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', state.user.id)
      .order('order', { ascending: true });

    const { data: extractionRows } = await supabase
      .from('extractions')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', state.user.id)
      .eq('type', extractionType);

    setBook(mappedBook);
    setChapters((chapterRows ?? []).map((row) => mapChapter(row as ChapterRow)));
    setExtractions((extractionRows ?? []).map((row) => mapExtraction(row as ExtractionRow)));
    setIsLoading(false);
  }, [state.user, topicId, bookId, extractionType, navigate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const extractionByChapter = useMemo(() => new Map(extractions.map((e) => [e.chapterId, e])), [extractions]);

  const outlineItems = useMemo(
    () => chapters.map((c) => ({ chapterId: c.id, label: c.title })),
    [chapters],
  );

  const headingLabel = extractionType ? EXTRACTION_HEADING_BY_TYPE[extractionType] : 'Extractions';

  const handleBack = useCallback(() => {
    if (topicId) navigate(`/topic/${topicId}`);
    else navigate('/home');
  }, [navigate, topicId]);

  const handleExplainLine = useCallback(
    async (itemId: string, sourceText: string) => {
      if (!state.settings) return;
      const text = sourceText.trim();
      if (!text) return;
      try {
        const explanation = await explain(text, state.settings);
        setPopup({ kind: 'explain', itemId, sourceText: text, explanation });
      } catch {
        /* surfaced via hook */
      }
    },
    [explain, state.settings],
  );

  const handlePinExplanationToItem = useCallback(() => {
    if (!popup || popup.kind !== 'explain' || !state.user || !bookId || !extractionType) return;
    const user = state.user;
    setPinsByItemId((prev) => {
      const next = { ...prev, [popup.itemId]: popup.explanation };
      writeExtractionPins(user.id, bookId, extractionType, next);
      return next;
    });
    setPopup(null);
  }, [popup, state.user, bookId, extractionType]);

  const handleSavePinNote = useCallback(
    (note: string) => {
      if (!popup || popup.kind !== 'pin' || !state.user || !bookId || !extractionType) return;
      const user = state.user;
      setPinsByItemId((prev) => {
        const next = { ...prev };
        if (note) {
          next[popup.itemId] = note;
        } else {
          delete next[popup.itemId];
        }
        writeExtractionPins(user.id, bookId, extractionType, next);
        return next;
      });
      setPopup(null);
    },
    [popup, state.user, bookId, extractionType],
  );

  const canUseSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  if (!state.user) {
    return <AuthenticatedSessionFallback />;
  }

  if (!topicId || !bookId) {
    return <Navigate to="/home" replace />;
  }

  if (!extractionType) {
    return <Navigate to={`/topic/${topicId}`} replace />;
  }

  if (isLoading || !book) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppHeader />
        <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading…</div>
      </div>
    );
  }

  const headerSubtitle = `${book.title} / ${headingLabel}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppHeader />

      <div className="w-full px-2 py-4 sm:px-3">
        <div className={READER_GRID_CLASS}>
          <aside className="order-2 lg:order-1">
            <ExtractionChapterOutlineNav items={outlineItems} />
          </aside>

          <div className="order-1 min-w-0 lg:order-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  ← Back
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{headingLabel}</p>
                  <h1 className="break-words text-xl font-semibold text-gray-900 dark:text-gray-100">{headerSubtitle}</h1>
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 lg:w-auto">
                <button
                  type="button"
                  className={SETTINGS_BTN_CLASS}
                  aria-label="Settings"
                  onClick={() => dispatch({ type: 'SET_SETTINGS_PANEL', payload: true })}
                >
                  {settingsGearIcon}
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>

            <article className={READER_ARTICLE_CLASS} style={READER_ARTICLE_STYLE}>
              {chapters.map((chapter) => {
                const extraction = extractionByChapter.get(chapter.id);
                const visibleItems = getVisibleExtractionItems(extraction);
                const sectionId = extractionChapterSectionId(chapter.id);
                return (
                  <section key={chapter.id} id={sectionId} className="border-b border-amber-100/80 py-6 last:border-b-0 last:pb-0 dark:border-stone-700/50">
                    <h2 className={CHAPTER_SECTION_TITLE_CLASS}>{chapter.title}</h2>
                    {!hasVisibleExtractionContent(extraction) ? (
                      <p className={`${CHAPTER_EMPTY_CLASS} mt-3`}>Nothing to show for this chapter.</p>
                    ) : (
                      <div className="mt-4 space-y-1">
                        {visibleItems.map((item) => {
                          const pinned = pinsByItemId[item.id] ?? '';
                          const displayText =
                            extractionType === 'definition' ? formatDefinitionInline(item.text) : item.text;
                          return (
                            <ExtractionLineStudyBlock
                              key={item.id}
                              itemId={item.id}
                              markdownText={displayText}
                              hasPinnedNote={Boolean(pinned)}
                              hasSettings={Boolean(state.settings)}
                              isAiBusy={isExplainLoading}
                              canReadAloud={canUseSpeech}
                              isReadAloudDisabled={!canUseSpeech || !item.text.trim()}
                              onExplain={() => {
                                void handleExplainLine(item.id, item.text);
                              }}
                              onSimplify={() => {
                                setPopup({ kind: 'simplify', sourceText: item.text });
                              }}
                              onPin={() => {
                                setPopup({ kind: 'pin', itemId: item.id, initialNote: pinned });
                              }}
                              onReadAloud={() => {
                                speakPlainText(item.text, state.settings?.ttsVoiceUri);
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
              {chapters.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No chapters in this book yet.</p>
              ) : null}
            </article>
          </div>
        </div>
      </div>

      {explainError ? (
        <p className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2 text-sm text-red-600 dark:text-red-400">{explainError}</p>
      ) : null}

      {popup?.kind === 'explain' ? (
        <ExplainPopup
          explanation={popup.explanation}
          onDismiss={() => setPopup(null)}
          onPin={handlePinExplanationToItem}
        />
      ) : null}

      {popup?.kind === 'simplify' ? <SimplifySourcePopup sourceText={popup.sourceText} onDismiss={() => setPopup(null)} /> : null}

      {popup?.kind === 'pin' ? (
        <PinNotePopup initialNote={popup.initialNote} onSave={handleSavePinNote} onDismiss={() => setPopup(null)} />
      ) : null}

      {isExplainLoading ? (
        <p className="fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded bg-white px-3 py-1 text-xs text-gray-700 shadow dark:bg-gray-900 dark:text-gray-200">
          Explaining…
        </p>
      ) : null}
    </div>
  );
}
