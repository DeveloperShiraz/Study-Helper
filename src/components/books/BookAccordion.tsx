import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import type { Book, Chapter } from '../../types';
import { ChapterRow } from './ChapterRow';
import { AddChapterModal } from './AddChapterModal';

interface BookAccordionProps {
  topicId: string;
  book: Book;
  chapters: Chapter[];
  onChanged: () => void;
}

export function BookAccordion({ topicId, book, chapters, onChanged }: BookAccordionProps) {
  const { state } = useApp();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
  const chapterIds = sortedChapters.map((c) => c.id);

  async function handleDeleteBook() {
    if (!state.user) return;
    const isConfirmed = window.confirm(`Delete book "${book.title}" and all chapters?`);
    if (!isConfirmed) return;
    const { error } = await supabase.from('books').delete().eq('id', book.id).eq('user_id', state.user.id);
    if (!error) onChanged();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !state.user) return;

    const oldIndex = sortedChapters.findIndex((c) => c.id === active.id);
    const newIndex = sortedChapters.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sortedChapters, oldIndex, newIndex);
    await Promise.all(
      reordered.map((ch, index) =>
        supabase.from('chapters').update({ order: index }).eq('id', ch.id).eq('user_id', state.user!.id),
      ),
    );
    onChanged();
  }

  const headerClass =
    'flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className={headerClass}>
        <button type="button" className="flex-1 font-semibold text-gray-900" onClick={() => setIsExpanded((e) => !e)}>
          {book.title}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
            onClick={() => setIsChapterModalOpen(true)}
          >
            + Chapter
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            onClick={handleDeleteBook}
          >
            Delete book
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2 border-t border-gray-100 p-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={chapterIds} strategy={verticalListSortingStrategy}>
              {sortedChapters.map((chapter) => (
                <ChapterRow key={chapter.id} topicId={topicId} chapter={chapter} onChanged={onChanged} />
              ))}
            </SortableContext>
          </DndContext>
          {sortedChapters.length === 0 && <p className="text-sm text-gray-500">No chapters yet.</p>}
        </div>
      )}

      <AddChapterModal
        isOpen={isChapterModalOpen}
        bookId={book.id}
        onClose={() => setIsChapterModalOpen(false)}
        onCreated={onChanged}
      />
    </div>
  );
}
