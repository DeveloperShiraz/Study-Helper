import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Book, Chapter } from '../../types';
import { BookAccordion } from './BookAccordion';

const DRAG_HANDLE_CLASS =
  'cursor-grab shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 active:cursor-grabbing dark:hover:bg-gray-800';

interface SortableBookAccordionProps {
  topicId: string;
  book: Book;
  chapters: Chapter[];
  onChanged: () => void;
}

export function SortableBookAccordion({ topicId, book, chapters, onChanged }: SortableBookAccordionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
  });

  const outerStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const sortableHandle = (
    <button type="button" className={DRAG_HANDLE_CLASS} aria-label="Reorder book" {...attributes} {...listeners}>
      ⋮⋮
    </button>
  );

  return (
    <BookAccordion
      ref={setNodeRef}
      outerStyle={outerStyle}
      sortableHandle={sortableHandle}
      topicId={topicId}
      book={book}
      chapters={chapters}
      onChanged={onChanged}
    />
  );
}
