import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

interface NewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopicCreated: () => void;
}

export function NewTopicModal({ isOpen, onClose, onTopicCreated }: NewTopicModalProps) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state } = useApp();

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !state.user) return;

    setIsCreating(true);
    setError(null);

    const { error: insertError } = await supabase.from('master_topics').insert({
      user_id: state.user.id,
      title: trimmedTitle,
    });

    if (insertError) {
      setError(insertError.message);
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    setTitle('');
    onTopicCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">New Master Topic</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="topic-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title
            </label>
            <input
              id="topic-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter topic title"
              disabled={isCreating}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
