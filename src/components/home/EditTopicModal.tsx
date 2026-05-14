import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { MasterTopic } from '../../types';

interface EditTopicModalProps {
  topic: MasterTopic | null;
  isOpen: boolean;
  onClose: () => void;
  onTopicUpdated: () => void;
}

export function EditTopicModal({ topic, isOpen, onClose, onTopicUpdated }: EditTopicModalProps) {
  const { state } = useApp();
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (topic) {
      setTitle(topic.title);
      setError(null);
    }
  }, [topic]);

  if (!isOpen || !topic) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topic) return;
    const trimmed = title.trim();
    if (!trimmed || !state.user) return;

    setIsSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('master_topics')
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq('id', topic.id)
      .eq('user_id', state.user.id);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onTopicUpdated();
    onClose();
  }

  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center';
  const panelClass = 'relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900';

  return (
    <div className={overlayClass}>
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className={panelClass}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rename Master Topic</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-topic-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title
            </label>
            <input
              id="edit-topic-title"
              type="text"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
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
