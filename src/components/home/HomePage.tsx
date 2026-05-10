import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapMasterTopic, mapUserSettings, type UserSettingsRow } from '../../lib/dbMappers';
import { useApp } from '../../context/AppContext';
import type { MasterTopic } from '../../types';
import AppHeader from '../layout/AppHeader';
import { MasterTopicCard } from './MasterTopicCard';
import { NewTopicModal } from './NewTopicModal';

export function HomePage() {
  const [topics, setTopics] = useState<MasterTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { state, dispatch } = useApp();
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

  useEffect(() => {
    if (!state.user) return;

    async function checkSettings() {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', state.user!.id)
        .maybeSingle();

      if (data) {
        dispatch({ type: 'SET_SETTINGS', payload: mapUserSettings(data as UserSettingsRow) });
      } else {
        dispatch({ type: 'SET_FIRST_LAUNCH', payload: true });
        dispatch({ type: 'SET_SETTINGS_PANEL', payload: true });
      }
    }

    checkSettings();
  }, [state.user, dispatch]);

  function handleTopicClick(topicId: string) {
    navigate(`/topic/${topicId}`);
  }

  if (!state.user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Master Topics</h1>

          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            + New Master Topic
          </button>
        </div>

        {isLoading ? (
          <div className="mt-12 text-center text-gray-500">Loading topics...</div>
        ) : topics.length === 0 ? (
          <div className="mt-12 text-center text-gray-500">
            No topics yet. Create your first Master Topic.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <MasterTopicCard
                key={topic.id}
                topic={topic}
                onClick={() => handleTopicClick(topic.id)}
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
    </div>
  );
}
