import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { extractChapterOutline } from '../../lib/chapterOutline';
import { mapBook, mapChapter, mapParagraph, type BookRow, type ChapterRow, type ParagraphRow } from '../../lib/dbMappers';
import { useApp } from '../../context/AppContext';
import { useTextSelection } from '../../hooks/useTextSelection';
import { paragraphPlain, useReadAlong } from '../../hooks/useReadAlong';
import { useAI } from '../../hooks/useAI';
import { computePlainOffsetFromSelection } from '../../lib/readAlongPlainOffset';
import {
  domSelectionStartOffsetInRoot,
  READ_ALONG_ROOT_SELECTOR,
} from '../../lib/readAlongDomText';
import {
  readStoredReadAlongSkipIncrement,
  writeStoredReadAlongSkipIncrement,
  type ReadAlongSkipIncrementSec,
} from '../../lib/readAlongSkipPersist';
import { readLocalTtsVoiceUri } from '../../lib/ttsVoiceLocalFallback';
import type { Book, Chapter, Paragraph } from '../../types';
import AppHeader from '../layout/AppHeader';
import { AuthenticatedSessionFallback } from '../layout/AuthenticatedSessionFallback';
import { ParagraphBlock } from './ParagraphBlock';
import { ChapterOutlineNav } from './ChapterOutlineNav';
import { ReadAlongToolbar } from './ReadAlongToolbar';
import { SelectionToolbar } from './SelectionToolbar';
import { ExplainPopup } from './ExplainPopup';
import { SimplifyPopup } from './SimplifyPopup';
import { PinNotePopup } from './PinNotePopup';

type PopupState =
  | { kind: 'explain'; paragraphId: string; selectionText: string; explanation: string }
  | { kind: 'simplify'; paragraph: Paragraph }
  | { kind: 'pin'; paragraphId: string; initialNote: string };

type ChapterLoadOptions = {
  /** When false, keep the reader mounted and only merge fresh data (avoids scroll jump). */
  showChapterSpinner?: boolean;
};

function findParagraphIdFromSelection(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (!node || !(node instanceof Element)) return null;
  const el = node.closest('[data-paragraph-id]');
  return el?.getAttribute('data-paragraph-id') ?? null;
}

export function ChapterReadingView() {
  const { topicId, bookId, chapterId } = useParams<{ topicId: string; bookId: string; chapterId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { selection, clearSelection } = useTextSelection();
  const { explain, isLoading: isExplainLoading, error: explainError } = useAI();

  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const readerAreaRef = useRef<HTMLElement>(null);
  const toolbarWrapRef = useRef<HTMLDivElement>(null);

  const [skipIncrementSec, setSkipIncrementSec] = useState<ReadAlongSkipIncrementSec>(
    readStoredReadAlongSkipIncrement,
  );
  const [isPageEditMode, setIsPageEditMode] = useState(false);

  const handleReadAlongSkipIncrementChange = useCallback((value: ReadAlongSkipIncrementSec) => {
    setSkipIncrementSec(value);
    writeStoredReadAlongSkipIncrement(value);
  }, []);

  const loadAll = useCallback(async (options?: ChapterLoadOptions) => {
    if (!state.user || !bookId || !chapterId) return;
    const showChapterSpinner = options?.showChapterSpinner ?? true;
    if (showChapterSpinner) {
      setIsLoading(true);
    }

    const { data: bookRow } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('user_id', state.user.id)
      .maybeSingle();

    const { data: chapterRow } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .eq('user_id', state.user.id)
      .maybeSingle();

    const { data: paragraphRows } = await supabase
      .from('paragraphs')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', state.user.id)
      .order('order', { ascending: true });

    if (!bookRow || !chapterRow) {
      navigate(`/topic/${topicId}`, { replace: true });
      if (showChapterSpinner) {
        setIsLoading(false);
      }
      return;
    }

    setBook(mapBook(bookRow as BookRow));
    setChapter(mapChapter(chapterRow as ChapterRow));
    setParagraphs((paragraphRows ?? []).map((row) => mapParagraph(row as ParagraphRow)));
    if (showChapterSpinner) {
      setIsLoading(false);
    }
  }, [state.user, bookId, chapterId, navigate, topicId]);

  const refreshChapterData = useCallback(() => {
    void loadAll({ showChapterSpinner: false });
  }, [loadAll]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (popup) return;

    function onDocMouseDown(e: MouseEvent) {
      if (!selection.text) return;
      const node = e.target as Node | null;
      if (!node) return;
      if (toolbarWrapRef.current?.contains(node)) return;
      if (readerAreaRef.current?.contains(node)) return;
      clearSelection();
    }

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [popup, selection.text, clearSelection]);

  const paragraphById = useMemo(() => new Map(paragraphs.map((p) => [p.id, p])), [paragraphs]);

  const sortedParagraphs = useMemo(
    () => [...paragraphs].sort((a, b) => a.order - b.order),
    [paragraphs],
  );

  const readAlong = useReadAlong(sortedParagraphs, {
    voiceUri: state.settings?.ttsVoiceUri ?? readLocalTtsVoiceUri(),
  });

  const handleClosePageEdit = useCallback(() => {
    setIsPageEditMode(false);
  }, []);

  const getReadAlongStartFromDom = useCallback((): { idx: number; offset: number } | null => {
    const sel = window.getSelection();
    if (!sel?.anchorNode || !readerAreaRef.current) {
      return null;
    }
    let node: Node | null = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }
    if (!(node instanceof Element)) {
      return null;
    }
    if (!readerAreaRef.current.contains(node)) {
      return null;
    }
    const host = node.closest('[data-paragraph-id]');
    const pid = host?.getAttribute('data-paragraph-id');
    if (!pid) {
      return null;
    }
    const idx = sortedParagraphs.findIndex((p) => p.id === pid);
    if (idx < 0) {
      return null;
    }
    const p = sortedParagraphs[idx];
    const readRoot =
      host instanceof HTMLElement ? host.querySelector(READ_ALONG_ROOT_SELECTOR) : null;
    if (readRoot instanceof HTMLElement) {
      const domOff = domSelectionStartOffsetInRoot(readRoot, sel);
      if (domOff !== null) {
        return { idx, offset: domOff };
      }
    }
    const plain = paragraphPlain(p);
    if (sel.isCollapsed) {
      return { idx, offset: 0 };
    }
    const t = sel.toString();
    if (!t.trim()) {
      return { idx, offset: 0 };
    }
    return { idx, offset: computePlainOffsetFromSelection(plain, t) };
  }, [sortedParagraphs]);

  const canReadFromSelection = readAlong.isSupported && getReadAlongStartFromDom() !== null;

  function handleReadAloudFromSelection() {
    if (!readAlong.isSupported) {
      return;
    }
    const start = getReadAlongStartFromDom();
    if (!start) {
      return;
    }
    readAlong.playFrom(start.idx, start.offset);
    clearSelection();
  }

  const outlineItems = useMemo(() => extractChapterOutline(paragraphs), [paragraphs]);

  const toolbarPosition = useMemo(() => {
    if (!selection.rect) return null;
    const top = selection.rect.bottom + 8;
    const left = selection.rect.left;
    return { top, left };
  }, [selection.rect]);

  const hasToolbar = selection.text.length > 0 && toolbarPosition;

  async function handleExplain() {
    if (!state.settings) return;
    const paragraphId = findParagraphIdFromSelection();
    if (!paragraphId) return;
    try {
      const explanation = await explain(selection.text, state.settings);
      setPopup({ kind: 'explain', paragraphId, selectionText: selection.text, explanation });
      clearSelection();
    } catch {
      /* surfaced via hook */
    }
  }

  function handleSimplify() {
    const paragraphId = findParagraphIdFromSelection();
    if (!paragraphId) return;
    const paragraph = paragraphById.get(paragraphId);
    if (!paragraph) return;
    setPopup({ kind: 'simplify', paragraph });
    clearSelection();
  }

  function handlePinNote() {
    const paragraphId = findParagraphIdFromSelection();
    if (!paragraphId) return;
    const paragraph = paragraphById.get(paragraphId);
    setPopup({ kind: 'pin', paragraphId, initialNote: paragraph?.pinnedNote ?? '' });
    clearSelection();
  }

  const handleExplainParagraph = useCallback(
    async (p: Paragraph) => {
      if (!state.settings) return;
      const text = paragraphPlain(p).trim();
      if (!text) return;
      try {
        const explanation = await explain(text, state.settings);
        setPopup({ kind: 'explain', paragraphId: p.id, selectionText: text, explanation });
      } catch {
        /* surfaced via hook */
      }
    },
    [explain, state.settings],
  );

  const handleSimplifyParagraph = useCallback((p: Paragraph) => {
    setPopup({ kind: 'simplify', paragraph: p });
  }, []);

  const handlePinParagraph = useCallback((p: Paragraph) => {
    setPopup({ kind: 'pin', paragraphId: p.id, initialNote: p.pinnedNote ?? '' });
  }, []);

  const handleReadAloudParagraph = useCallback(
    (p: Paragraph) => {
      if (!readAlong.isSupported) return;
      const idx = sortedParagraphs.findIndex((x) => x.id === p.id);
      if (idx < 0) return;
      readAlong.playFrom(idx, 0);
    },
    [readAlong, sortedParagraphs],
  );

  async function handlePinExplanation() {
    if (!state.user || !popup || popup.kind !== 'explain') return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ pinned_note: popup.explanation, updated_at: new Date().toISOString() })
      .eq('id', popup.paragraphId)
      .eq('user_id', state.user.id);
    if (!error) {
      setPopup(null);
      await loadAll({ showChapterSpinner: false });
    }
  }

  async function handleSavePinNote(note: string) {
    if (!state.user || !popup || popup.kind !== 'pin') return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ pinned_note: note || null, updated_at: new Date().toISOString() })
      .eq('id', popup.paragraphId)
      .eq('user_id', state.user.id);
    if (!error) {
      setPopup(null);
      await loadAll({ showChapterSpinner: false });
    }
  }

  async function handleUseOriginal() {
    if (!state.user || !popup || popup.kind !== 'simplify') return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ active_version: 'original', updated_at: new Date().toISOString() })
      .eq('id', popup.paragraph.id)
      .eq('user_id', state.user.id);
    if (!error) {
      setPopup(null);
      await loadAll({ showChapterSpinner: false });
    }
  }

  async function handleUseModified(text: string) {
    if (!state.user || !popup || popup.kind !== 'simplify') return;
    const { error } = await supabase
      .from('paragraphs')
      .update({
        modified: text,
        active_version: 'modified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', popup.paragraph.id)
      .eq('user_id', state.user.id);
    if (!error) {
      setPopup(null);
      await loadAll({ showChapterSpinner: false });
    }
  }

  async function handleDeleteParagraph(paragraphId: string) {
    if (!state.user) return;
    const { error } = await supabase
      .from('paragraphs')
      .delete()
      .eq('id', paragraphId)
      .eq('user_id', state.user.id);
    if (!error) {
      await loadAll({ showChapterSpinner: false });
    }
  }

  function handleBack() {
    if (topicId) navigate(`/topic/${topicId}`);
    else navigate('/home');
  }

  function handleTogglePageEdit() {
    if (isPageEditMode) {
      setIsPageEditMode(false);
      return;
    }
    if (readAlong.isRunning) {
      readAlong.stop();
    }
    setIsPageEditMode(true);
  }

  if (!state.user) {
    return <AuthenticatedSessionFallback />;
  }

  if (isLoading || !book || !chapter) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppHeader />
        <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading chapter…</div>
      </div>
    );
  }

  const headerSubtitle = `${book.title} / ${chapter.title}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-950">
      <AppHeader />

      <div className="w-full px-2 py-4 sm:px-3">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_1fr] lg:gap-4">
          <aside className="order-2 lg:order-1">
            <ChapterOutlineNav items={outlineItems} />
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
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Reading</p>
                  <h1 className="break-words text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {headerSubtitle}
                  </h1>
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 lg:w-auto">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isPageEditMode
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={handleTogglePageEdit}
                >
                  {isPageEditMode ? 'Done editing' : 'Edit'}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  aria-label="Settings"
                  onClick={() => dispatch({ type: 'SET_SETTINGS_PANEL', payload: true })}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>

            <article
              ref={readerAreaRef}
              data-reader-main
              className="mt-8 space-y-2 rounded-2xl border border-amber-100/80 bg-[#faf8f4] p-6 shadow-md sm:p-8 dark:border-stone-700/60 dark:bg-[#1e1c18]"
              style={{
                fontSize: 'var(--study-helper-reader-font, 18px)',
                fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
                lineHeight: '1.8',
              }}
            >
              {sortedParagraphs.map((p) => (
                <ParagraphBlock
                  key={p.id}
                  paragraph={p}
                  onUpdated={refreshChapterData}
                  onDeleteParagraph={() => {
                    void handleDeleteParagraph(p.id);
                  }}
                  isReadAlongActive={readAlong.activeParagraphId === p.id}
                  readAlongHighlight={readAlong.highlight}
                  isPageEditMode={isPageEditMode}
                  isReadAlongRunning={readAlong.isRunning}
                  onClosePageEdit={handleClosePageEdit}
                  isStudyRailVisible={!isPageEditMode}
                  hasStudySettings={Boolean(state.settings)}
                  isStudyRailAiBusy={isExplainLoading}
                  canStudyReadAloud={readAlong.isSupported}
                  isStudyReadAloudDisabled={!readAlong.isSupported || readAlong.isRunning}
                  onStudyExplain={() => {
                    void handleExplainParagraph(p);
                  }}
                  onStudySimplify={() => {
                    handleSimplifyParagraph(p);
                  }}
                  onStudyPin={() => {
                    handlePinParagraph(p);
                  }}
                  onStudyReadAloud={
                    readAlong.isSupported
                      ? () => {
                          handleReadAloudParagraph(p);
                        }
                      : undefined
                  }
                />
              ))}
              {paragraphs.length === 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">No paragraphs yet.</p>
              )}
            </article>
          </div>
        </div>
      </div>

      {hasToolbar && toolbarPosition && (
        <div ref={toolbarWrapRef} data-selection-toolbar>
          <SelectionToolbar
            top={toolbarPosition.top}
            left={toolbarPosition.left}
            onExplain={handleExplain}
            onSimplify={handleSimplify}
            onPinNote={handlePinNote}
            onReadAloud={readAlong.isSupported ? handleReadAloudFromSelection : undefined}
            isReadAloudDisabled={!getReadAlongStartFromDom()}
          />
        </div>
      )}

      {explainError && (
        <p className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 text-sm text-red-600 dark:text-red-400">
          {explainError}
        </p>
      )}

      {popup?.kind === 'explain' && (
        <ExplainPopup
          explanation={popup.explanation}
          onPin={handlePinExplanation}
          onDismiss={() => setPopup(null)}
        />
      )}

      {popup?.kind === 'simplify' && (
        <SimplifyPopup
          paragraph={popup.paragraph}
          onUseOriginal={handleUseOriginal}
          onUseModified={handleUseModified}
          onDismiss={() => setPopup(null)}
        />
      )}

      {popup?.kind === 'pin' && (
        <PinNotePopup
          initialNote={popup.initialNote}
          onSave={handleSavePinNote}
          onDismiss={() => setPopup(null)}
        />
      )}

      {isExplainLoading && (
        <p className="fixed bottom-40 left-1/2 z-40 -translate-x-1/2 rounded bg-white px-3 py-1 text-xs text-gray-700 shadow dark:bg-gray-900 dark:text-gray-200">
          Explaining…
        </p>
      )}

      <ReadAlongToolbar
        isSupported={readAlong.isSupported}
        isRunning={readAlong.isRunning}
        isPaused={readAlong.isPaused}
        canReadFromSelection={canReadFromSelection}
        skipIncrementSec={skipIncrementSec}
        onSkipIncrementSecChange={handleReadAlongSkipIncrementChange}
        onPlayChapter={readAlong.playAll}
        onPlayFromSelection={handleReadAloudFromSelection}
        onPause={readAlong.pause}
        onResume={readAlong.resume}
        onStop={readAlong.stop}
        onSkipSeconds={readAlong.skipSeconds}
      />
    </div>
  );
}
