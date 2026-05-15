import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from '../../../lib/supabase';
import { mapBook, mapChapter, type BookRow, type ChapterRow } from '../../../lib/dbMappers';
import { useApp } from '../../../context/AppContext';
import type { Book, Chapter } from '../../../types';
import { SortableBookAccordion } from '../../books/SortableBookAccordion';
import { AddBookModal } from '../../books/AddBookModal';
import { AuthenticatedSessionFallback } from '../../layout/AuthenticatedSessionFallback';

interface BooksTabProps {
  topicId: string;
}

export function BooksTab({ topicId }: BooksTabProps) {
  const { state } = useApp();
  const [books, setBooks] = useState<Book[]>([]);
  const [chaptersByBook, setChaptersByBook] = useState<Record<string, Chapter[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);

  const bookSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sortedBooks = useMemo(() => [...books].sort((a, b) => a.order - b.order), [books]);
  const bookIds = useMemo(() => sortedBooks.map((b) => b.id), [sortedBooks]);

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!state.user) return;
      const isSilent = options?.silent === true;
      if (!isSilent) {
        setIsLoading(true);
      }

      try {
        const { data: bookRows } = await supabase
          .from('books')
          .select('*')
          .eq('master_topic_id', topicId)
          .eq('user_id', state.user.id)
          .order('order', { ascending: true });

        const mappedBooks = (bookRows ?? []).map((row) => mapBook(row as BookRow));
        setBooks(mappedBooks);

        if (mappedBooks.length === 0) {
          setChaptersByBook({});
          return;
        }

        const mappedBookIds = mappedBooks.map((b) => b.id);
        const { data: chapterRows } = await supabase
          .from('chapters')
          .select('*')
          .in('book_id', mappedBookIds)
          .eq('user_id', state.user.id)
          .order('order', { ascending: true });

        const grouped: Record<string, Chapter[]> = {};
        for (const b of mappedBooks) {
          grouped[b.id] = [];
        }
        for (const row of chapterRows ?? []) {
          const ch = mapChapter(row as ChapterRow);
          if (!grouped[ch.bookId]) grouped[ch.bookId] = [];
          grouped[ch.bookId].push(ch);
        }
        setChaptersByBook(grouped);
      } finally {
        if (!isSilent) {
          setIsLoading(false);
        }
      }
    },
    [state.user, topicId],
  );

  const refreshBooksDataSilently = useCallback(() => {
    void loadData({ silent: true });
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleBookDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !state.user) return;
    const userId = state.user.id;

    const oldIndex = sortedBooks.findIndex((b) => b.id === active.id);
    const newIndex = sortedBooks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sortedBooks, oldIndex, newIndex);
    const optimisticBooks = reordered.map((b, index) => ({ ...b, order: index }));
    setBooks(optimisticBooks);

    const results = await Promise.all(
      reordered.map((b, index) =>
        supabase.from('books').update({ order: index }).eq('id', b.id).eq('user_id', userId),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      window.alert(failed.error.message);
      void loadData({ silent: true });
    }
  }

  if (!state.user) {
    return <AuthenticatedSessionFallback />;
  }

  if (isLoading) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Loading books…</p>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Books</h2>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => setIsAddBookOpen(true)}
          >
            + Add Book
          </button>
        </div>

      {books.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No books yet. Add your first book.</p>
      ) : (
        <DndContext sensors={bookSensors} collisionDetection={closestCenter} onDragEnd={handleBookDragEnd}>
          <SortableContext items={bookIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedBooks.map((book) => (
                <SortableBookAccordion
                  key={book.id}
                  topicId={topicId}
                  book={book}
                  chapters={chaptersByBook[book.id] ?? []}
                  onChanged={refreshBooksDataSilently}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddBookModal
        isOpen={isAddBookOpen}
        topicId={topicId}
        onClose={() => setIsAddBookOpen(false)}
        onCreated={loadData}
      />
      </div>
    </div>
  );
}
