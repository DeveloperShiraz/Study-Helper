import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { Paragraph } from '../../types';
import type { ReadAlongHighlight } from '../../hooks/useReadAlong';
import { useReadAlongDomHighlight } from '../../hooks/useReadAlongDomHighlight';
import { createReaderMarkdownComponents } from './markdownReaderComponents';
import { VersionToggle } from './VersionToggle';
import { ParagraphStudyRail } from './ParagraphStudyRail';

const MarkdownParagraph = lazy(() => import('react-markdown'));

interface ParagraphBlockProps {
  paragraph: Paragraph;
  onUpdated: () => void;
  onDeleteParagraph?: () => void;
  isReadAlongActive?: boolean;
  readAlongHighlight?: ReadAlongHighlight | null;
  isPageEditMode?: boolean;
  isReadAlongRunning?: boolean;
  onClosePageEdit?: () => void;
  isStudyRailVisible?: boolean;
  hasStudySettings?: boolean;
  isStudyRailAiBusy?: boolean;
  canStudyReadAloud?: boolean;
  isStudyReadAloudDisabled?: boolean;
  onStudyExplain?: () => void;
  onStudySimplify?: () => void;
  onStudyPin?: () => void;
  onStudyReadAloud?: () => void;
}

export function ParagraphBlock({
  paragraph,
  onUpdated,
  onDeleteParagraph,
  isReadAlongActive = false,
  readAlongHighlight = null,
  isPageEditMode = false,
  isReadAlongRunning = false,
  onClosePageEdit,
  isStudyRailVisible = false,
  hasStudySettings = false,
  isStudyRailAiBusy = false,
  canStudyReadAloud = false,
  isStudyReadAloudDisabled = true,
  onStudyExplain,
  onStudySimplify,
  onStudyPin,
  onStudyReadAloud,
}: ParagraphBlockProps) {
  const { state } = useApp();
  const [draft, setDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const readAlongRootRef = useRef<HTMLDivElement>(null);
  useReadAlongDomHighlight(paragraph.id, readAlongHighlight, readAlongRootRef);

  const displayText =
    paragraph.activeVersion === 'modified' ? (paragraph.modified ?? paragraph.original) : paragraph.original;

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

  const draftLines = useMemo(() => draft.split('\n'), [draft]);

  const handleDraftLineChange = useCallback((index: number, value: string) => {
    setDraft((prev) => {
      const lines = prev.split('\n');
      lines[index] = value;
      return lines.join('\n');
    });
  }, []);

  const handleRemoveDraftLine = useCallback((index: number) => {
    setDraft((prev) => {
      const lines = prev.split('\n');
      if (lines.length <= 1) {
        return '';
      }
      lines.splice(index, 1);
      return lines.join('\n');
    });
  }, []);

  const handleAddDraftLine = useCallback(() => {
    setDraft((prev) => (prev.length === 0 ? '\n' : `${prev}\n`));
  }, []);

  const handleDeleteParagraphClick = useCallback(() => {
    if (!onDeleteParagraph || isReadAlongRunning) {
      return;
    }
    const confirmed = window.confirm('Remove this entire paragraph from the chapter?');
    if (!confirmed) {
      return;
    }
    onDeleteParagraph();
  }, [onDeleteParagraph, isReadAlongRunning]);

  const blockClass = isReadAlongActive
    ? 'group relative rounded-lg border border-amber-400/80 bg-amber-50/60 px-3 py-3 ring-2 ring-amber-400/60 dark:border-amber-700/70 dark:bg-amber-950/20 dark:ring-amber-500/50'
    : 'group relative rounded-lg border border-transparent px-3 py-3 hover:border-amber-200/60 dark:hover:border-stone-600/50';
  const markdownBodyClass =
    'flex-1 min-w-0 space-y-2 text-stone-800 dark:text-stone-200 [&_code]:rounded [&_code]:bg-amber-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] dark:[&_code]:bg-stone-800 dark:[&_code]:text-stone-100 [&_a]:text-amber-700 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-amber-400';
  const markdownFallbackClass =
    'm-0 whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-gray-100';
  const editActionsClass = 'mt-2 flex flex-wrap gap-2';
  const primaryBtnClass =
    'rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
  const secondaryBtnClass =
    'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800';
  const lineEditorWrapClass =
    'mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50/90 p-3 dark:border-gray-700 dark:bg-gray-900/60';
  const lineEditorLegendClass = 'text-xs font-medium text-gray-600 dark:text-gray-300';
  const lineRowClass = 'flex items-start gap-2';
  const lineInputClass =
    'min-h-[2.5rem] flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 font-mono text-[0.9em] leading-snug text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100';
  const lineRemoveBtnClass =
    'shrink-0 rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/80 dark:text-red-300 dark:hover:bg-red-950/40';
  const addLineBtnClass =
    'rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800';
  const deleteParagraphBtnClass =
    'rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-200 dark:hover:bg-red-950/40';

  const hasStudyRailCallbacks = Boolean(
    onStudyExplain && onStudySimplify && onStudyPin && (canStudyReadAloud ? onStudyReadAloud : true),
  );
  const shouldShowStudyRail = isStudyRailVisible && hasStudyRailCallbacks;

  return (
    <div className={blockClass} data-paragraph-id={paragraph.id}>
      <div className="flex flex-wrap items-start gap-2 sm:gap-3">
        <div ref={readAlongRootRef} data-read-along-root className={`${markdownBodyClass} min-w-0 flex-1`}>
          {isPageEditMode ? (
            <>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Edit each line below, or remove a line with its button. Save writes the modified version; use Original /
                Modified to compare.
              </p>
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
                {onDeleteParagraph && (
                  <button
                    type="button"
                    className={deleteParagraphBtnClass}
                    disabled={isReadAlongRunning}
                    onClick={handleDeleteParagraphClick}
                  >
                    Delete paragraph
                  </button>
                )}
              </div>
              <fieldset className={lineEditorWrapClass}>
                <legend className={lineEditorLegendClass}>Lines — remove one line at a time</legend>
                <div className="mt-2 space-y-2">
                  {draftLines.map((line, lineIndex) => {
                    const lineInputId = `paragraph-line-${paragraph.id}-${String(lineIndex)}`;
                    return (
                      <div key={lineIndex} className={lineRowClass}>
                        <label htmlFor={lineInputId} className="sr-only">
                          {`Line ${String(lineIndex + 1)}`}
                        </label>
                        <textarea
                          id={lineInputId}
                          rows={2}
                          className={lineInputClass}
                          value={line}
                          onChange={(e) => {
                            handleDraftLineChange(lineIndex, e.target.value);
                          }}
                          spellCheck
                        />
                        <button
                          type="button"
                          className={lineRemoveBtnClass}
                          disabled={isReadAlongRunning || draftLines.length <= 1}
                          title={
                            draftLines.length <= 1
                              ? 'Clear this line text or delete the whole paragraph'
                              : 'Remove this line'
                          }
                          onClick={() => {
                            handleRemoveDraftLine(lineIndex);
                          }}
                        >
                          Remove line
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={`${addLineBtnClass} mt-2`}
                  disabled={isReadAlongRunning}
                  onClick={handleAddDraftLine}
                >
                  Add line
                </button>
              </fieldset>
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
        {shouldShowStudyRail && onStudyExplain && onStudySimplify && onStudyPin ? (
          <ParagraphStudyRail
            hasPinnedNote={Boolean(paragraph.pinnedNote)}
            isAiBusy={isStudyRailAiBusy}
            hasSettings={hasStudySettings}
            canReadAloud={canStudyReadAloud}
            isReadAloudDisabled={isStudyReadAloudDisabled}
            onExplain={onStudyExplain}
            onSimplify={onStudySimplify}
            onPin={onStudyPin}
            onReadAloud={canStudyReadAloud ? onStudyReadAloud : undefined}
          />
        ) : null}
      </div>

      {!isPageEditMode && <VersionToggle paragraph={paragraph} onSelect={handleVersionChange} />}
    </div>
  );
}
