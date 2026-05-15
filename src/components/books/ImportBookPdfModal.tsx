import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { structurePdfSegmentToChapterJson } from '../../ai/adapter';
import { useApp } from '../../context/AppContext';
import { resolveAiSettingsForTask } from '../../lib/aiTaskSettings';
import {
  buildChapterPageRanges,
  formatChapterRangesSummary,
  formatSegmentPlainText,
  parseChapterPageRangesList,
  parseChapterStartPageList,
  validateChapterStartsAgainstPageCount,
} from '../../lib/pdfChapterSegments';
import { extractPdfPageTexts } from '../../lib/pdfText';
import { MAX_PDF_IMPORT_BYTES, PDF_IMPORT_MS_BETWEEN_GEMINI_SEGMENTS, isPdfFile } from '../../lib/pdfImport';
import { sleepMs } from '../../lib/sleep';
import { insertChapterWithParagraphs } from '../../lib/supabaseChapterInsert';
import { supabase } from '../../lib/supabase';

const CHAPTER_BOUNDS_MODE_STARTS = 'starts';
const CHAPTER_BOUNDS_MODE_RANGES = 'ranges';

type ChapterBoundsInputMode = typeof CHAPTER_BOUNDS_MODE_STARTS | typeof CHAPTER_BOUNDS_MODE_RANGES;

interface ImportBookPdfModalProps {
  isOpen: boolean;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onImported: () => void;
  /** Lets a host (e.g. app shell) know when AI requests are in flight so another import cannot start. */
  onImportRunningChange?: (isRunning: boolean) => void;
}

export function ImportBookPdfModal({
  isOpen,
  bookId,
  bookTitle,
  onClose,
  onImported,
  onImportRunningChange,
}: ImportBookPdfModalProps) {
  const { state } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chapterBoundsInputRef = useRef<HTMLTextAreaElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [chapterStartsInput, setChapterStartsInput] = useState('');
  const [chapterBoundsInputMode, setChapterBoundsInputMode] =
    useState<ChapterBoundsInputMode>(CHAPTER_BOUNDS_MODE_STARTS);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setPdfFile(null);
    setPageTexts(null);
    setPageCount(0);
    setChapterStartsInput('');
    setChapterBoundsInputMode(CHAPTER_BOUNDS_MODE_STARTS);
    setProgressMessage(null);
    setError(null);
    setIsReadingPdf(false);
    setIsImporting(false);
    setIsDragOver(false);
    importAbortRef.current = null;
    onImportRunningChange?.(false);
  }, [isOpen, onImportRunningChange]);

  useEffect(() => {
    return () => {
      onImportRunningChange?.(false);
    };
  }, [onImportRunningChange]);

  useEffect(() => {
    if (!isImporting) {
      return;
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isImporting]);

  const chapterBoundsPreview = useMemo(() => {
    const empty = {
      summary: null as string | null,
      hint: null as string | null,
      highlight: null as { start: number; end: number } | null,
      resumeNote: null as string | null,
    };
    if (pageCount < 1) {
      return empty;
    }
    if (chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_RANGES) {
      const pr = parseChapterPageRangesList(chapterStartsInput, pageCount);
      if (!pr.ok) {
        return { summary: null, hint: pr.reason, highlight: pr.highlight ?? null, resumeNote: null };
      }
      const firstStart = pr.ranges[0]?.startPage ?? 1;
      const resumeNote =
        firstStart > 1
          ? `Pages 1–${String(firstStart - 1)} are omitted in this run (append later pages only).`
          : null;
      return { summary: formatChapterRangesSummary(pr.ranges), hint: null, highlight: null, resumeNote };
    }
    const parsed = parseChapterStartPageList(chapterStartsInput);
    if (parsed === 'invalid') {
      return {
        summary: null,
        hint: 'Use positive whole numbers separated by commas or spaces (example: 5, 13, 19, 28).',
        highlight: null,
        resumeNote: null,
      };
    }
    const ve = validateChapterStartsAgainstPageCount(pageCount, parsed);
    if (ve) {
      return { summary: null, hint: ve, highlight: null, resumeNote: null };
    }
    const ranges = buildChapterPageRanges(pageCount, parsed);
    return { summary: formatChapterRangesSummary(ranges), hint: null, highlight: null, resumeNote: null };
  }, [chapterBoundsInputMode, chapterStartsInput, pageCount]);

  function handleSelectChapterBoundsIssue() {
    const el = chapterBoundsInputRef.current;
    const hl = chapterBoundsPreview.highlight;
    if (!el || hl === null) {
      return;
    }
    el.focus();
    el.setSelectionRange(hl.start, hl.end);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function loadPdfFile(file: File) {
    if (!isPdfFile(file)) {
      setError('Please use a PDF file (.pdf).');
      return;
    }
    if (file.size > MAX_PDF_IMPORT_BYTES) {
      setError(`PDF is too large (max ${Math.round(MAX_PDF_IMPORT_BYTES / (1024 * 1024))} MB).`);
      return;
    }
    setIsReadingPdf(true);
    setError(null);
    setProgressMessage(null);
    setPdfFile(null);
    setPageTexts(null);
    setPageCount(0);
    try {
      const extracted = await extractPdfPageTexts(file);
      setPdfFile(file);
      setPageTexts(extracted.pageTexts);
      setPageCount(extracted.pageCount);
      setProgressMessage(`Loaded ${extracted.pageCount} pages from ${file.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read PDF pages.');
    } finally {
      setIsReadingPdf(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void loadPdfFile(file);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void loadPdfFile(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDismiss() {
    if (isImporting) {
      importAbortRef.current?.abort();
      importAbortRef.current = null;
      onImportRunningChange?.(false);
      setIsImporting(false);
      setProgressMessage('Import cancelled.');
      return;
    }
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state.user || !state.settings) {
      setError('Sign in and configure AI in Settings first.');
      return;
    }
    if (!pdfFile || !pageTexts || pageCount < 1) {
      setError('Drop a PDF and wait until page count appears.');
      return;
    }

    let ranges;
    if (chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_RANGES) {
      const pr = parseChapterPageRangesList(chapterStartsInput, pageCount);
      if (!pr.ok) {
        setError(pr.reason);
        return;
      }
      ranges = pr.ranges;
    } else {
      const parsed = parseChapterStartPageList(chapterStartsInput);
      if (parsed === 'invalid') {
        setError('Chapter starts must be positive whole numbers, comma or space separated (e.g. 5, 13, 19, 28).');
        return;
      }

      const startsErr = validateChapterStartsAgainstPageCount(pageCount, parsed);
      if (startsErr) {
        setError(startsErr);
        return;
      }

      ranges = buildChapterPageRanges(pageCount, parsed);
    }

    if (ranges.length === 0) {
      setError('No page ranges to import.');
      return;
    }

    const ac = new AbortController();
    importAbortRef.current = ac;
    onImportRunningChange?.(true);
    setIsImporting(true);
    setError(null);

    const userId = state.user.id;

    const { data: existing } = await supabase
      .from('chapters')
      .select('order')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextOrder = existing?.order != null ? existing.order + 1 : 0;
    const pdfAiSettings = resolveAiSettingsForTask(state.settings, 'pdfImport');

    try {
      for (let i = 0; i < ranges.length; i++) {
        if (ac.signal.aborted) {
          setProgressMessage('Import cancelled.');
          return;
        }

        const range = ranges[i];
        const segmentPlain = formatSegmentPlainText(pageTexts, range);
        if (!segmentPlain.trim()) {
          setProgressMessage(`Skipping empty segment (pages ${range.startPage}–${range.endPage}).`);
          continue;
        }

        const rangeLabel = `${range.startPage}–${range.endPage}`;
        setProgressMessage(`Structuring ${i + 1} / ${ranges.length} (PDF pages ${rangeLabel})…`);

        const structured = await structurePdfSegmentToChapterJson(
          segmentPlain,
          pdfFile.name,
          i + 1,
          rangeLabel,
          pdfAiSettings,
          ac.signal,
        );

        const insertResult = await insertChapterWithParagraphs({
          userId,
          bookId,
          title: structured.title,
          rawMarkdown: structured.contentMarkdown,
          order: nextOrder,
        });

        if (!insertResult.ok) {
          throw new Error(insertResult.error);
        }

        nextOrder += 1;

        const hasMoreSegments = i < ranges.length - 1;
        if (hasMoreSegments && pdfAiSettings.provider === 'gemini') {
          const pauseSec = Math.round(PDF_IMPORT_MS_BETWEEN_GEMINI_SEGMENTS / 1000);
          setProgressMessage(`Pausing ~${String(pauseSec)}s before next chapter (Gemini rate limits)…`);
          try {
            await sleepMs(PDF_IMPORT_MS_BETWEEN_GEMINI_SEGMENTS, ac.signal);
          } catch {
            setProgressMessage('Import cancelled.');
            return;
          }
        }
      }

      if (!ac.signal.aborted) {
        setProgressMessage(`Imported ${ranges.length} segment(s).`);
        onImported();
      }
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        setProgressMessage('Import cancelled.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Import failed partway through.';
      setError(`${msg} Partial imports are kept—reopen the book if you do not see new chapters.`);
    } finally {
      importAbortRef.current = null;
      onImportRunningChange?.(false);
      setIsImporting(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  const overlayWrapClass = 'fixed inset-0 z-[100] flex items-center justify-center p-4';
  const backdropClass = 'absolute inset-0 bg-black/50';
  const panelClass =
    'relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900';
  const dropZoneBaseClass =
    'mt-2 flex min-h-[100px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors';
  const dropZoneStateClass = isDragOver
    ? 'cursor-pointer border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
    : 'cursor-pointer border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-950/50 dark:hover:border-gray-500';
  const dropZoneClass = `${dropZoneBaseClass} ${dropZoneStateClass}`;
  const secondaryButtonClass =
    'rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';
  const choosePdfButtonClass = `mt-3 ${secondaryButtonClass}`;
  const cancelButtonClass =
    'rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';
  const submitButtonClass =
    'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
  const chapterStartsPlaceholder = 'e.g. 5, 13, 19, 28';
  const chapterRangesPlaceholder = 'e.g. 1-4, 5-12, 13-END  or  resume: 37-90, 91-END';
  const chapterBoundsFieldLabel =
    chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_STARTS
      ? 'Chapter start pages (1-based PDF page numbers)'
      : 'Chapter page ranges (start–end per chapter; last range must reach the final page)';
  const chapterBoundsHelperStarts = (
    <>
      Example <span className="font-mono text-gray-700 dark:text-gray-300">5, 13, 19, 28</span>: pages 1–4 become one
      chapter, then 5–12, 13–18, 19–27, 28 through the last page. The preview below shows each segment as{' '}
      <span className="font-mono text-gray-700 dark:text-gray-300">start–end</span>. Leave empty for one chapter for
      the whole PDF. To import <span className="font-medium text-gray-800 dark:text-gray-200">only from page 37 on</span>{' '}
      without re-reading pages 1–36, switch to &quot;I will type each chapter as start–end&quot; and list ranges
      beginning at 37 (e.g. <span className="font-mono text-gray-700 dark:text-gray-300">37-END</span>).
    </>
  );
  const chapterBoundsHelperRanges = (
    <>
      List each chapter as <span className="font-mono text-gray-700 dark:text-gray-300">start-end</span> (hyphen or
      en dash), or a <span className="font-mono text-gray-700 dark:text-gray-300">single page number</span> for a
      one-page chapter. Separate chapters with commas, semicolons, or newlines. Use{' '}
      <span className="font-mono text-gray-700 dark:text-gray-300">158-END</span> for the last stretch through the
      final page. Ranges must not overlap; after the first chapter they must meet with no gaps. You may{' '}
      <span className="font-medium text-gray-800 dark:text-gray-200">start the first range after page 1</span> to
      append only later pages (already-imported early pages are not duplicated). Example:{' '}
      <span className="font-mono text-gray-700 dark:text-gray-300">37-100, 101-END</span>.
    </>
  );
  const previewWrapClass =
    'mt-2 rounded-lg border border-gray-200 bg-gray-50/90 p-3 dark:border-gray-700 dark:bg-gray-900/50';
  const previewLabelClass = 'text-xs font-medium text-gray-700 dark:text-gray-300';
  const previewSummaryClass = 'mt-1 break-words font-mono text-xs leading-relaxed text-gray-900 dark:text-gray-100';
  const previewHintClass = 'mt-1 text-xs text-amber-800 dark:text-amber-200';
  const jumpToIssueButtonClass =
    'mt-2 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-900 dark:text-indigo-200 dark:hover:bg-indigo-950/50';
  const radioLabelClass = 'flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300';
  const fieldsetLegendClass = 'text-sm font-medium text-gray-700 dark:text-gray-300';
  const isSubmitDisabled =
    isReadingPdf || isImporting || !pdfFile || pageCount < 1 || !state.settings || !state.user;
  const importingHint =
    'You can switch browser tabs or move to another page in this app—the import keeps running. Closing or refreshing this site will stop it.';
  const resolvedPdfImportSettings = state.settings
    ? resolveAiSettingsForTask(state.settings, 'pdfImport')
    : null;
  const geminiMultiChapterNote =
    resolvedPdfImportSettings?.provider === 'gemini'
      ? ` With Gemini, the importer waits about ${String(Math.round(PDF_IMPORT_MS_BETWEEN_GEMINI_SEGMENTS / 1000))} seconds between chapters to reduce 429 rate limits.`
      : '';

  const modalTree = (
    <div className={overlayWrapClass}>
      {isImporting ? (
        <div className={backdropClass} aria-hidden />
      ) : (
        <button type="button" className={backdropClass} aria-label="Close" onClick={handleDismiss} />
      )}
      <div className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import PDF (auto chapters)</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Book: <span className="font-medium text-gray-900 dark:text-gray-100">{bookTitle}</span>
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Pages are read in the browser (pdf.js). Each segment is sent to your configured AI as plain text and
            returned as Markdown chapters. Use the same providers as chat (OpenAI-compatible, Anthropic, Gemini). For
            full PDF vision import of a single chapter, use &quot;+ Chapter&quot; instead.
            {geminiMultiChapterNote}
          </p>
          {isImporting && <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{importingHint}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={handleFileInputChange}
          />

          <div
            role="presentation"
            className={dropZoneClass}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isReadingPdf ? (
              <span className="text-gray-700 dark:text-gray-300">Reading PDF pages…</span>
            ) : (
              <>
                <span className="font-medium text-gray-900 dark:text-gray-100">Drop PDF here</span>
                <button type="button" className={choosePdfButtonClass} onClick={() => fileInputRef.current?.click()}>
                  Choose PDF
                </button>
                <span className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  Max ~{Math.round(MAX_PDF_IMPORT_BYTES / (1024 * 1024))} MB
                </span>
              </>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className={fieldsetLegendClass}>Chapter boundaries</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
              <label className={radioLabelClass}>
                <input
                  type="radio"
                  name="chapter-bounds-mode"
                  className="text-indigo-600 focus:ring-indigo-500"
                  checked={chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_STARTS}
                  onChange={() => {
                    setChapterBoundsInputMode(CHAPTER_BOUNDS_MODE_STARTS);
                  }}
                  disabled={isImporting}
                />
                New chapter starts at these pages
              </label>
              <label className={radioLabelClass}>
                <input
                  type="radio"
                  name="chapter-bounds-mode"
                  className="text-indigo-600 focus:ring-indigo-500"
                  checked={chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_RANGES}
                  onChange={() => {
                    setChapterBoundsInputMode(CHAPTER_BOUNDS_MODE_RANGES);
                  }}
                  disabled={isImporting}
                />
                I will type each chapter as start–end
              </label>
            </div>

            <label htmlFor="chapter-bounds-input" className="mt-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {chapterBoundsFieldLabel}
            </label>
            <textarea
              id="chapter-bounds-input"
              ref={chapterBoundsInputRef}
              rows={4}
              className="mt-1 block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              value={chapterStartsInput}
              onChange={(e) => {
                setChapterStartsInput(e.target.value);
              }}
              placeholder={
                chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_STARTS
                  ? chapterStartsPlaceholder
                  : chapterRangesPlaceholder
              }
              disabled={isImporting}
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_STARTS ? chapterBoundsHelperStarts : chapterBoundsHelperRanges}
            </p>
            {pageCount > 0 && (chapterBoundsPreview.summary !== null || chapterBoundsPreview.hint !== null) ? (
              <div className={previewWrapClass}>
                <p className={previewLabelClass}>Preview — each segment becomes one imported chapter (PDF pages)</p>
                {chapterBoundsPreview.summary !== null ? (
                  <p className={previewSummaryClass}>{chapterBoundsPreview.summary}</p>
                ) : null}
                {chapterBoundsPreview.resumeNote !== null ? (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{chapterBoundsPreview.resumeNote}</p>
                ) : null}
                {chapterBoundsPreview.summary === null && chapterBoundsPreview.hint !== null ? (
                  <p className={previewHintClass}>{chapterBoundsPreview.hint}</p>
                ) : null}
                {chapterBoundsPreview.highlight !== null && chapterBoundsPreview.hint !== null ? (
                  <button type="button" className={jumpToIssueButtonClass} onClick={handleSelectChapterBoundsIssue}>
                    Select problem in text above
                  </button>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          {progressMessage && <p className="text-sm text-indigo-800 dark:text-indigo-300">{progressMessage}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {error && chapterBoundsInputMode === CHAPTER_BOUNDS_MODE_RANGES && chapterBoundsPreview.highlight !== null ? (
            <button type="button" className={jumpToIssueButtonClass} onClick={handleSelectChapterBoundsIssue}>
              Select problem in chapter box
            </button>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className={cancelButtonClass} onClick={handleDismiss}>
              {isImporting ? 'Cancel import' : 'Close'}
            </button>
            <button type="submit" className={submitButtonClass} disabled={isSubmitDisabled}>
              {isImporting ? 'Importing…' : 'Import chapters'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalTree, document.body);
}
