import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { Chapter } from '../../types';

interface ChapterRowProps {
  topicId: string;
  chapter: Chapter;
  onChanged: () => void;
}

const BTN_ROW =
  'rounded px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-800';
const BTN_DANGER =
  'rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40';

export function ChapterRow({ topicId, chapter, onChanged }: ChapterRowProps) {
  const navigate = useNavigate();
  const { state } = useApp();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chapter.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(chapter.title);
    }
  }, [chapter.title, chapter.id, isEditingTitle]);

  async function handleDelete() {
    if (!state.user) return;
    const isConfirmed = window.confirm(`Delete chapter "${chapter.title}"?`);
    if (!isConfirmed) return;
    const { error } = await supabase.from('chapters').delete().eq('id', chapter.id).eq('user_id', state.user.id);
    if (!error) onChanged();
  }

  async function handleSaveTitle(e: FormEvent) {
    e.preventDefault();
    if (!state.user) return;
    const next = draftTitle.trim();
    if (!next) return;
    const { error } = await supabase
      .from('chapters')
      .update({ title: next, updated_at: new Date().toISOString() })
      .eq('id', chapter.id)
      .eq('user_id', state.user.id);
    if (!error) {
      setIsEditingTitle(false);
      onChanged();
    }
  }

  function handleOpen() {
    navigate(`/topic/${topicId}/book/${chapter.bookId}/chapter/${chapter.id}`);
  }

  const rowClass =
    'flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-950';

  return (
    <div ref={setNodeRef} style={sortableStyle} className={rowClass}>
      <button
        type="button"
        className="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Reorder chapter"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      {isEditingTitle ? (
        <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={handleSaveTitle}>
          <input
            className="min-w-[8rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            autoFocus
            aria-label="Chapter title"
          />
          <button type="submit" className={BTN_ROW}>
            Save
          </button>
          <button
            type="button"
            className={BTN_ROW}
            onClick={() => {
              setIsEditingTitle(false);
              setDraftTitle(chapter.title);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className="flex-1 text-left font-medium text-gray-900 hover:text-indigo-700 dark:text-gray-100 dark:hover:text-indigo-400"
            onClick={handleOpen}
          >
            {chapter.title}
          </button>
          <button type="button" className={BTN_ROW} onClick={() => setIsEditingTitle(true)}>
            Edit
          </button>
          <button type="button" className={BTN_DANGER} onClick={handleDelete}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
