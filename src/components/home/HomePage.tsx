import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapMasterTopic } from '../../lib/dbMappers';
import { useApp } from '../../context/AppContext';
import type { MasterTopic } from '../../types';
import AppHeader from '../layout/AppHeader';
import { AuthenticatedSessionFallback } from '../layout/AuthenticatedSessionFallback';
import { MasterTopicCard } from './MasterTopicCard';
import { NewTopicModal } from './NewTopicModal';
import { EditTopicModal } from './EditTopicModal';

export function HomePage() {
  const [topics, setTopics] = useState<MasterTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topicToEdit, setTopicToEdit] = useState<MasterTopic | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { state } = useApp();
  const navigate = useNavigate();

  const fetchTopics = useCallback(async () => {
    if (!state.user) return;

    const { data } = await supabase
      .from('master_topics')
      .select('*')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setTopics(data.map((row) => mapMasterTopic(row as Parameters<typeof mapMasterTopic>[0])));
    }
    setIsLoading(false);
  }, [state.user]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  function handleTopicClick(topicId: string) {
    navigate(`/topic/${topicId}`);
  }

  async function handleDeleteTopic(topic: MasterTopic) {
    if (!state.user) return;
    const isConfirmed = window.confirm(
      `Delete "${topic.title}" and all books, chapters, notes, and extractions under it? This cannot be undone.`,
    );
    if (!isConfirmed) return;

    const { error } = await supabase.from('master_topics').delete().eq('id', topic.id).eq('user_id', state.user.id);
    if (!error) {
      await fetchTopics();
    }
  }

  if (!state.user) {
    return <AuthenticatedSessionFallback />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Topics</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Organise your study material into topics, books, and chapters.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New topic
          </button>
        </div>

        {isLoading ? (
          <div className="mt-12 text-center text-gray-500 dark:text-gray-400">Loading topics…</div>
        ) : topics.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">No topics yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create your first topic to start organising your study material.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create first topic
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <MasterTopicCard
                key={topic.id}
                topic={topic}
                onOpen={() => handleTopicClick(topic.id)}
                onEdit={() => {
                  setTopicToEdit(topic);
                  setIsEditModalOpen(true);
                }}
                onDelete={() => handleDeleteTopic(topic)}
              />
            ))}
          </div>
        )}
      </main>

      <NewTopicModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTopicCreated={fetchTopics}
      />

      <EditTopicModal
        topic={topicToEdit}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setTopicToEdit(null);
        }}
        onTopicUpdated={fetchTopics}
      />
    </div>
  );
}
