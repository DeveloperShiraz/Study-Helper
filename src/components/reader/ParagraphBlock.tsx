import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { Paragraph } from '../../types';
import type { ReadAlongHighlight } from '../../hooks/useReadAlong';
import { useReadAlongDomHighlight } from '../../hooks/useReadAlongDomHighlight';
import { createReaderMarkdownComponents } from './markdownReaderComponents';
import { VersionToggle } from './VersionToggle';

const MarkdownParagraph = lazy(() => import('react-markdown'));

interface ParagraphBlockProps {
  paragraph: Paragraph;
  onUpdated: () => void;
  isReadAlongActive?: boolean;
  readAlongHighlight?: ReadAlongHighlight | null;
  isPageEditMode?: boolean;
  isReadAlongRunning?: boolean;
  onClosePageEdit?: () => void;
}

export function ParagraphBlock({
  paragraph,
  onUpdated,
  isReadAlongActive = false,
  readAlongHighlight = null,
  isPageEditMode = false,
  isReadAlongRunning = false,
  onClosePageEdit,
}: ParagraphBlockProps) {
  const { state } = useApp();
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const readAlongRootRef = useRef<HTMLDivElement>(null);
  useReadAlongDomHighlight(paragraph.id, readAlongHighlight, readAlongRootRef);

  const displayText =
    paragraph.activeVersion === 'modified' && paragraph.modified ? paragraph.modified : paragraph.original;

  useEffect(() => {
    setDraft(displayText);
  }, [displayText, paragraph.id]);

  const markdownComponents = useMemo(
    () => createReaderMarkdownComponents(paragraph.id),
    [paragraph.id, displayText],
  );

  async function handleVersionChange(version: Paragraph['activeVersion']) {
    if (!state.user) return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ active_version: version, updated_at: new Date().toISOString() })
      .eq('id', paragraph.id)
      .eq('user_id', state.user.id);
    if (!error) onUpdated();
  }

  async function handleDeleteNote() {
    if (!state.user) return;
    const { error } = await supabase
      .from('paragraphs')
      .update({ pinned_note: null, updated_at: new Date().toISOString() })
      .eq('id', paragraph.id)
      .eq('user_id', state.user.id);
    if (!error) {
      setIsNoteOpen(false);
      onUpdated();
    }
  }

  async function handleSavePageEdit() {
    if (!state.user || isReadAlongRunning) return;
    setIsSavingEdit(true);
    const { error } = await supabase
      .from('paragraphs')
      .update({
        modified: draft,
        active_version: 'modified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paragraph.id)
      .eq('user_id', state.user.id);
    setIsSavingEdit(false);
    if (!error) {
      onUpdated();
      onClosePageEdit?.();
    }
  }

  const readAlongRootStyle = { fontSize: 'var(--study-helper-reader-font, 18px)' };

  const blockClass = isReadAlongActive
    ? 'group relative rounded-lg border border-amber-400/80 bg-amber-50/50 px-2 py-3 ring-2 ring-amber-400/70 dark:border-amber-700 dark:bg-amber-950/30 dark:ring-amber-500/60'
    : 'group relative rounded-lg border border-transparent px-2 py-3 hover:border-gray-200 dark:hover:border-gray-700';
  const markdownBodyClass =
    'flex-1 min-w-0 space-y-2 leading-relaxed text-gray-900 dark:text-gray-100 [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm dark:[&_code]:bg-gray-800 dark:[&_code]:text-gray-100 [&_a]:text-indigo-600 [&_a]:underline dark:[&_a]:text-indigo-400';
  const markdownFallbackClass =
    'm-0 whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-gray-100';
  const editTextareaClass =
    'min-h-[12rem] w-full resize-y rounded-lg border border-indigo-300 bg-white p-3 font-mono text-[0.95em] leading-relaxed text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-700 dark:bg-gray-950 dark:text-gray-100';
  const editActionsClass = 'mt-2 flex flex-wrap gap-2';
  const primaryBtnClass =
    'rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
  const secondaryBtnClass =
    'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800';

  return (
    <div className={blockClass} data-paragraph-id={paragraph.id}>
      <div className="flex gap-3">
        <div ref={readAlongRootRef} data-read-along-root className={markdownBodyClass} style={readAlongRootStyle}>
          {isPageEditMode ? (
            <>
              <textarea
                className={editTextareaClass}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck
                aria-label="Edit paragraph markdown"
                disabled={isReadAlongRunning}
              />
              <div className={editActionsClass}>
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={isSavingEdit || isReadAlongRunning}
                  onClick={() => void handleSavePageEdit()}
                >
                  {isSavingEdit ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={isReadAlongRunning}
                  onClick={() => {
                    setDraft(displayText);
                    onClosePageEdit?.();
                  }}
                >
                  Cancel
                </button>
              </div>
              {isReadAlongRunning && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  Stop read-aloud before editing.
                </p>
              )}
            </>
          ) : (
            <Suspense fallback={<p className={markdownFallbackClass}>{displayText}</p>}>
              <MarkdownParagraph components={markdownComponents}>{displayText}</MarkdownParagraph>
            </Suspense>
          )}
        </div>
        {paragraph.pinnedNote && (
          <button
            type="button"
            className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
            aria-label="View pinned note"
            onClick={() => setIsNoteOpen((v) => !v)}
          >
            Pin
          </button>
        )}
      </div>

      {!isPageEditMode && <VersionToggle paragraph={paragraph} onSelect={handleVersionChange} />}

      {isNoteOpen && paragraph.pinnedNote && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-gray-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-gray-100">
          <p className="whitespace-pre-wrap">{paragraph.pinnedNote}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="text-xs text-red-700 hover:underline"
              onClick={handleDeleteNote}
            >
              Delete note
            </button>
            <button type="button" className="text-xs text-gray-700 hover:underline" onClick={() => setIsNoteOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
