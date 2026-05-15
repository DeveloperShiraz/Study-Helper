import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { insertChapterWithParagraphs } from '../../lib/supabaseChapterInsert';
import { extractChapterTextFromPdf } from '../../ai/adapter';
import { resolveAiSettingsForTask } from '../../lib/aiTaskSettings';
import { MAX_PDF_IMPORT_BYTES, isPdfFile } from '../../lib/pdfImport';
import { useApp } from '../../context/AppContext';

interface AddChapterModalProps {
  isOpen: boolean;
  bookId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddChapterModal({ isOpen, bookId, onClose, onCreated }: AddChapterModalProps) {
  const { state } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfHint, setPdfHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function ingestPdf(file: File) {
    if (!isPdfFile(file)) {
      setError('Please use a PDF file (.pdf).');
      return;
    }
    if (file.size > MAX_PDF_IMPORT_BYTES) {
      setError(`PDF is too large for AI import (max ${Math.round(MAX_PDF_IMPORT_BYTES / (1024 * 1024))} MB).`);
      return;
    }
    if (!state.settings) {
      setError('Open Settings and save your AI configuration before importing a PDF.');
      return;
    }
    setIsPdfLoading(true);
    setError(null);
    setPdfHint(null);
    try {
      const pdfAiSettings = resolveAiSettingsForTask(state.settings, 'pdfImport');
      const { text, sourceLabel } = await extractChapterTextFromPdf(file, pdfAiSettings, title);
      if (!text.trim()) {
        setError('The model returned no text. Try again, paste manually, or use a different model.');
        return;
      }
      setContent(text);
      setPdfHint(`${file.name} · extracted with ${sourceLabel}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import PDF');
    } finally {
      setIsPdfLoading(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void ingestPdf(file);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void ingestPdf(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const raw = content;
    if (!trimmedTitle || !state.user) return;

    const userId = state.user.id;

    setIsSaving(true);
    setError(null);

    const { data: existing } = await supabase
      .from('chapters')
      .select('order')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = existing?.order != null ? existing.order + 1 : 0;

    const insertResult = await insertChapterWithParagraphs({
      userId,
      bookId,
      title: trimmedTitle,
      rawMarkdown: raw,
      order: nextOrder,
    });

    if (!insertResult.ok) {
      setError(insertResult.error);
      setIsSaving(false);
      return;
    }

    setTitle('');
    setContent('');
    setPdfHint(null);
    setIsSaving(false);
    onCreated();
    onClose();
  }

  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center';
  const panelClass =
    'relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900';
  const dropZoneBaseClass =
    'mt-2 flex min-h-[120px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors';
  const dropZoneStateClass = isDragOver
    ? 'cursor-pointer border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
    : 'cursor-pointer border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-950/50 dark:hover:border-gray-500';
  const dropZoneClass = `${dropZoneBaseClass} ${dropZoneStateClass}`;
  const secondaryButtonClass =
    'rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';
  const choosePdfButtonClass = `mt-3 ${secondaryButtonClass}`;

  return (
    <div className={overlayClass}>
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Chapter</h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden">
          <div>
            <label htmlFor="chapter-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Chapter title
            </label>
            <input
              id="chapter-title"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Chapter source</span>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Drop a PDF and your configured AI will read it—when Settings uses{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">OpenAI</span> (official API; models such
              as gpt-4o, gpt-4o-mini, or gpt-4.1 that support PDF on the Responses API),{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">Anthropic</span> (Claude 3.5 Sonnet or
              newer),{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">Amazon Bedrock</span> (Claude with PDF in
              Messages, same credentials as elsewhere in Settings), or{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">Google Gemini</span> (Flash / Pro with
              PDF via the Gemini API—see Settings for doc links).{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">DeepSeek</span> (including v4 Pro),
              OpenRouter, and similar chat APIs are text-only here, so PDF import is not available—paste text instead,
              or switch provider for import. Max about {Math.round(MAX_PDF_IMPORT_BYTES / (1024 * 1024))} MB. Very long
              chapters may stop at the model output limit—paste any remainder manually. You can still type or paste
              below instead.
            </p>

            <input
              ref={fileInputRef}
              id="chapter-pdf-file"
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
              {isPdfLoading ? (
                <span className="text-gray-700 dark:text-gray-300">Reading PDF with AI…</span>
              ) : (
                <>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Drop PDF here</span>
                  <button type="button" className={choosePdfButtonClass} onClick={() => fileInputRef.current?.click()}>
                    Choose PDF file
                  </button>
                  <span className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Max ~{Math.round(MAX_PDF_IMPORT_BYTES / (1024 * 1024))} MB · OpenAI, Anthropic, or Gemini in
                    Settings
                  </span>
                </>
              )}
            </div>

            {pdfHint && <p className="mt-2 text-xs text-green-700 dark:text-green-400">{pdfHint}</p>}

            <label htmlFor="chapter-content" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Text (from AI PDF import or paste)
            </label>
            <textarea
              id="chapter-content"
              className="mt-1 min-h-[200px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="After PDF import, text may include Markdown (## headings, **bold**, - lists). Separate reader paragraphs with a blank line. Or paste plain text."
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={onClose}
              disabled={isSaving || isPdfLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isPdfLoading || !title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Chapter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
