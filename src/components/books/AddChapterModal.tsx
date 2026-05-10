import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

interface AddChapterModalProps {
  isOpen: boolean;
  bookId: string;
  onClose: () => void;
  onCreated: () => void;
}

function splitIntoParagraphs(raw: string): string[] {
  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function AddChapterModal({ isOpen, bookId, onClose, onCreated }: AddChapterModalProps) {
  const { state } = useApp();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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

    const { data: chapterRow, error: chapterError } = await supabase
      .from('chapters')
      .insert({
        user_id: userId,
        book_id: bookId,
        title: trimmedTitle,
        order: nextOrder,
        raw_content: raw,
      })
      .select('id')
      .single();

    if (chapterError || !chapterRow) {
      setError(chapterError?.message ?? 'Could not create chapter');
      setIsSaving(false);
      return;
    }

    const parts = splitIntoParagraphs(raw);
    const paragraphRows = parts.map((text, index) => ({
      user_id: userId,
      chapter_id: chapterRow.id,
      order: index,
      original: text,
      modified: null,
      active_version: 'original' as const,
      pinned_note: null,
    }));

    if (paragraphRows.length > 0) {
      const { error: paragraphError } = await supabase.from('paragraphs').insert(paragraphRows);
      if (paragraphError) {
        setError(paragraphError.message);
        setIsSaving(false);
        return;
      }
    }

    setTitle('');
    setContent('');
    setIsSaving(false);
    onCreated();
    onClose();
  }

  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center';
  const panelClass = 'relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white p-6 shadow-xl';

  return (
    <div className={overlayClass}>
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900">Add Chapter</h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden">
          <div>
            <label htmlFor="chapter-title" className="block text-sm font-medium text-gray-700">
              Chapter title
            </label>
            <input
              id="chapter-title"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <label htmlFor="chapter-content" className="block text-sm font-medium text-gray-700">
              Paste chapter content
            </label>
            <textarea
              id="chapter-content"
              className="mt-1 min-h-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Separate paragraphs with a blank line."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
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
