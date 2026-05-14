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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Master Topics</h1>

          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950"
          >
            + New Master Topic
          </button>
        </div>

        {isLoading ? (
          <div className="mt-12 text-center text-gray-500 dark:text-gray-400">Loading topics...</div>
        ) : topics.length === 0 ? (
          <div className="mt-12 text-center text-gray-500 dark:text-gray-400">
            No topics yet. Create your first Master Topic.
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
