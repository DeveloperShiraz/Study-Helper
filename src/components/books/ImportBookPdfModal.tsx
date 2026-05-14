import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { structurePdfSegmentToChapterJson } from '../../ai/adapter';
import { useApp } from '../../context/AppContext';
import {
  buildChapterPageRanges,
  formatSegmentPlainText,
  parseChapterStartPageList,
  validateChapterStartsAgainstPageCount,
} from '../../lib/pdfChapterSegments';
import { extractPdfPageTexts } from '../../lib/pdfText';
import { MAX_PDF_IMPORT_BYTES, isPdfFile } from '../../lib/pdfImport';
import { insertChapterWithParagraphs } from '../../lib/supabaseChapterInsert';
import { supabase } from '../../lib/supabase';

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
  const importAbortRef = useRef<AbortController | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [chapterStartsInput, setChapterStartsInput] = useState('');
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

    const ranges = buildChapterPageRanges(pageCount, parsed);
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
          state.settings,
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
  const isSubmitDisabled =
    isReadingPdf || isImporting || !pdfFile || pageCount < 1 || !state.settings || !state.user;
  const importingHint =
    'You can switch browser tabs or move to another page in this app—the import keeps running. Closing or refreshing this site will stop it.';

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

          <div>
            <label htmlFor="chapter-starts" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Chapter start pages (1-based PDF page numbers)
            </label>
            <input
              id="chapter-starts"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              value={chapterStartsInput}
              onChange={(e) => setChapterStartsInput(e.target.value)}
              placeholder={chapterStartsPlaceholder}
              disabled={isImporting}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Example <span className="font-mono text-gray-700 dark:text-gray-300">5, 13, 19, 28</span>: pages 1–4
              become one chapter, page 5 starts the next, then 13, 19, 28. Leave empty to import the whole PDF as one
              chapter (one AI pass).
            </p>
          </div>

          {progressMessage && <p className="text-sm text-indigo-800 dark:text-indigo-300">{progressMessage}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
