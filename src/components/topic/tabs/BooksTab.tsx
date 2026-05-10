import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { mapBook, mapChapter, type BookRow, type ChapterRow } from '../../../lib/dbMappers';
import { useApp } from '../../../context/AppContext';
import type { Book, Chapter } from '../../../types';
import { BookAccordion } from '../../books/BookAccordion';
import { AddBookModal } from '../../books/AddBookModal';

interface BooksTabProps {
  topicId: string;
}

export function BooksTab({ topicId }: BooksTabProps) {
  const { state } = useApp();
  const [books, setBooks] = useState<Book[]>([]);
  const [chaptersByBook, setChaptersByBook] = useState<Record<string, Chapter[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!state.user) return;
    setIsLoading(true);

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
      setIsLoading(false);
      return;
    }

    const bookIds = mappedBooks.map((b) => b.id);
    const { data: chapterRows } = await supabase
      .from('chapters')
      .select('*')
      .in('book_id', bookIds)
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
    setIsLoading(false);
  }, [state.user, topicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!state.user) return null;

  if (isLoading) {
    return <p className="text-sm text-gray-600">Loading books…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Books</h2>
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={() => setIsAddBookOpen(true)}
        >
          + Add Book
        </button>
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-gray-600">No books yet. Add your first book.</p>
      ) : (
        <div className="space-y-3">
          {books.map((book) => (
            <BookAccordion
              key={book.id}
              topicId={topicId}
              book={book}
              chapters={chaptersByBook[book.id] ?? []}
              onChanged={loadData}
            />
          ))}
        </div>
      )}

      <AddBookModal
        isOpen={isAddBookOpen}
        topicId={topicId}
        onClose={() => setIsAddBookOpen(false)}
        onCreated={loadData}
      />
    </div>
  );
}
