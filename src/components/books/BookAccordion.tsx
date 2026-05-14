import { forwardRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode } from 'react';
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
import { usePdfBookImport } from '../../context/PdfBookImportContext';
import { ChapterRow } from './ChapterRow';
import { AddChapterModal } from './AddChapterModal';

export interface BookAccordionProps {
  topicId: string;
  book: Book;
  chapters: Chapter[];
  onChanged: () => void;
  /** Drag handle for book-level reorder (Books tab). */
  sortableHandle?: ReactNode;
  /** Applied to the root card (e.g. transform while dragging). */
  outerStyle?: CSSProperties;
}

const BTN_SECONDARY =
  'rounded-lg bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 dark:bg-gray-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-indigo-950/50';
const BTN_DANGER =
  'rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40';
const BTN_GHOST =
  'rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800';

export const BookAccordion = forwardRef<HTMLDivElement, BookAccordionProps>(function BookAccordion(
  { topicId, book, chapters, onChanged, sortableHandle, outerStyle },
  ref,
) {
  const { state } = useApp();
  const { openPdfBookImport } = usePdfBookImport();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [isRenamingBook, setIsRenamingBook] = useState(false);
  const [draftBookTitle, setDraftBookTitle] = useState(book.title);
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

  async function handleSaveBookTitle(e: FormEvent) {
    e.preventDefault();
    if (!state.user) return;
    const next = draftBookTitle.trim();
    if (!next) return;
    const { error } = await supabase.from('books').update({ title: next }).eq('id', book.id).eq('user_id', state.user.id);
    if (!error) {
      setIsRenamingBook(false);
      onChanged();
    }
  }

  function handleStartRename(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setDraftBookTitle(book.title);
    setIsRenamingBook(true);
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
    'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left dark:border-gray-700 dark:bg-gray-900/50';

  return (
    <div
      ref={ref}
      style={outerStyle}
      className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className={headerClass}>
        {isRenamingBook ? (
          <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={handleSaveBookTitle}>
            {sortableHandle}
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
              value={draftBookTitle}
              onChange={(e) => setDraftBookTitle(e.target.value)}
              autoFocus
              aria-label="Book title"
            />
            <button type="submit" className={BTN_SECONDARY}>
              Save
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              onClick={() => {
                setIsRenamingBook(false);
                setDraftBookTitle(book.title);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {sortableHandle}
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-semibold text-gray-900 dark:text-gray-100"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {book.title}
            </button>
            <button type="button" className={BTN_GHOST} onClick={handleStartRename}>
              Rename
            </button>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={() => setIsChapterModalOpen(true)}>
            + Chapter
          </button>
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() =>
              openPdfBookImport({
                bookId: book.id,
                bookTitle: book.title,
                onImported: onChanged,
              })
            }
          >
            Import PDF (chapters)
          </button>
          <button type="button" className={BTN_DANGER} onClick={handleDeleteBook}>
            Delete book
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-800">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={chapterIds} strategy={verticalListSortingStrategy}>
              {sortedChapters.map((chapter) => (
                <ChapterRow key={chapter.id} topicId={topicId} chapter={chapter} onChanged={onChanged} />
              ))}
            </SortableContext>
          </DndContext>
          {sortedChapters.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No chapters yet.</p>
          )}
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
});

BookAccordion.displayName = 'BookAccordion';
