import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapBook, mapChapter, mapParagraph, type BookRow, type ChapterRow, type ParagraphRow } from '../../lib/dbMappers';
import { useApp } from '../../context/AppContext';
import { useTextSelection } from '../../hooks/useTextSelection';
import { useAI } from '../../hooks/useAI';
import type { Book, Chapter, Paragraph } from '../../types';
import AppHeader from '../layout/AppHeader';
import { ParagraphBlock } from './ParagraphBlock';
import { SelectionToolbar } from './SelectionToolbar';
import { ExplainPopup } from './ExplainPopup';
import { SimplifyPopup } from './SimplifyPopup';
import { PinNotePopup } from './PinNotePopup';
import { MusicPlayerBar } from '../music/MusicPlayerBar';

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

  const paragraphById = useMemo(() => new Map(paragraphs.map((p) => [p.id, p])), [paragraphs]);

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

  if (!state.user) return null;

  if (isLoading || !book || !chapter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="p-8 text-center text-gray-600">Loading chapter…</div>
      </div>
    );
  }

  const headerSubtitle = `${book.title} / ${chapter.title}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader />

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
            >
              ← Back
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Reading</p>
              <h1 className="text-xl font-semibold text-gray-900">{headerSubtitle}</h1>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-200"
            aria-label="Settings"
            onClick={() => dispatch({ type: 'SET_SETTINGS_PANEL', payload: true })}
          >
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>

        <article className="mt-8 space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {paragraphs.map((p) => (
            <ParagraphBlock key={p.id} paragraph={p} onUpdated={loadAll} />
          ))}
          {paragraphs.length === 0 && <p className="text-sm text-gray-600">No paragraphs yet.</p>}
        </article>
      </div>

      {hasToolbar && toolbarPosition && (
        <SelectionToolbar
          top={toolbarPosition.top}
          left={toolbarPosition.left}
          onExplain={handleExplain}
          onSimplify={handleSimplify}
          onPinNote={handlePinNote}
        />
      )}

      {explainError && <p className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 text-sm text-red-600">{explainError}</p>}

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

      <MusicPlayerBar />

      {isExplainLoading && (
        <p className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded bg-white px-3 py-1 text-xs text-gray-700 shadow">
          Explaining…
        </p>
      )}
    </div>
  );
}
