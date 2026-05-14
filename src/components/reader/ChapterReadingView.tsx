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

  const loadAll = useCallback(async () => {
    if (!state.user || !bookId || !chapterId) return;
    setIsLoading(true);

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
      setIsLoading(false);
      return;
    }

    setBook(mapBook(bookRow as BookRow));
    setChapter(mapChapter(chapterRow as ChapterRow));
    setParagraphs((paragraphRows ?? []).map((row) => mapParagraph(row as ParagraphRow)));
    setIsLoading(false);
  }, [state.user, bookId, chapterId, navigate, topicId]);

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

  async function handlePinExplanation() {
    if (!state.user || !popup || popup.kind !== 'explain') return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ pinned_note: popup.explanation, updated_at: new Date().toISOString() })
      .eq('id', popup.paragraphId)
      .eq('user_id', state.user.id);
    if (!error) {
      setPopup(null);
      await loadAll();
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
      await loadAll();
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
      await loadAll();
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
      await loadAll();
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

  const articleTypographyStyle = { fontSize: 'var(--study-helper-reader-font, 18px)' };

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

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(11rem,14rem)_minmax(0,42rem)] lg:justify-center lg:gap-10">
          <aside className="order-2 lg:order-1 lg:justify-self-end lg:pr-2">
            <ChapterOutlineNav items={outlineItems} />
          </aside>

          <div className="order-1 min-w-0 lg:order-2 lg:w-full">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
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
                  {isPageEditMode ? 'Done editing' : 'Edit on page'}
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
                  aria-label="Settings"
                  onClick={() => dispatch({ type: 'SET_SETTINGS_PANEL', payload: true })}
                >
                  <span className="text-sm font-medium">Settings</span>
                </button>
              </div>
            </div>

            <article
              ref={readerAreaRef}
              data-reader-main
              style={articleTypographyStyle}
              className="mt-8 space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              {sortedParagraphs.map((p) => (
                <ParagraphBlock
                  key={p.id}
                  paragraph={p}
                  onUpdated={loadAll}
                  isReadAlongActive={readAlong.activeParagraphId === p.id}
                  readAlongHighlight={readAlong.highlight}
                  isPageEditMode={isPageEditMode}
                  isReadAlongRunning={readAlong.isRunning}
                  onClosePageEdit={handleClosePageEdit}
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
