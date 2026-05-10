import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

interface AddBookModalProps {
  isOpen: boolean;
  topicId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddBookModal({ isOpen, topicId, onClose, onCreated }: AddBookModalProps) {
  const { state } = useApp();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !state.user) return;

    setIsSaving(true);
    setError(null);

    const { data: existing } = await supabase
      .from('books')
      .select('order')
      .eq('master_topic_id', topicId)
      .eq('user_id', state.user.id)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = existing?.order != null ? existing.order + 1 : 0;

    const { error: insertError } = await supabase.from('books').insert({
      user_id: state.user.id,
      master_topic_id: topicId,
      title: trimmed,
      order: nextOrder,
    });

    if (insertError) {
      setError(insertError.message);
      setIsSaving(false);
      return;
    }

    setTitle('');
    setIsSaving(false);
    onCreated();
    onClose();
  }

  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center';
  const panelClass = 'relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl';

  return (
    <div className={overlayClass}>
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900">Add Book</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="book-title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="book-title"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
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
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
