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

export function ChapterRow({ topicId, chapter, onChanged }: ChapterRowProps) {
  const navigate = useNavigate();
  const { state } = useApp();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  async function handleDelete() {
    if (!state.user) return;
    const isConfirmed = window.confirm(`Delete chapter "${chapter.title}"?`);
    if (!isConfirmed) return;
    const { error } = await supabase.from('chapters').delete().eq('id', chapter.id).eq('user_id', state.user.id);
    if (!error) onChanged();
  }

  function handleOpen() {
    navigate(`/topic/${topicId}/book/${chapter.bookId}/chapter/${chapter.id}`);
  }

  const rowClass =
    'flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm';

  return (
    <div ref={setNodeRef} style={sortableStyle} className={rowClass}>
      <button
        type="button"
        className="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-100"
        aria-label="Reorder chapter"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" className="flex-1 text-left font-medium text-gray-900 hover:text-indigo-700" onClick={handleOpen}>
        {chapter.title}
      </button>
      <button
        type="button"
        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        onClick={handleDelete}
      >
        Delete
      </button>
    </div>
  );
}
