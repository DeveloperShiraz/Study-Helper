import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapMasterTopic, type MasterTopicRow } from '../../lib/dbMappers';
import { useApp } from '../../context/AppContext';
import type { MasterTopic } from '../../types';
import AppHeader from '../layout/AppHeader';
import { AuthenticatedSessionFallback } from '../layout/AuthenticatedSessionFallback';
import { TopicTabNav, type TopicTabId } from './TopicTabNav';
import { BooksTab } from './tabs/BooksTab';
import { FormulasTab } from './tabs/FormulasTab';
import { DefinitionsTab } from './tabs/DefinitionsTab';
import { ComparisonsTab } from './tabs/ComparisonsTab';
import { SummariesTab } from './tabs/SummariesTab';
import { EditTopicModal } from '../home/EditTopicModal';

export function MasterTopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { state } = useApp();
  const [topic, setTopic] = useState<MasterTopic | null>(null);
  const [activeTab, setActiveTab] = useState<TopicTabId>('books');
  const [mountedTabs, setMountedTabs] = useState<Set<TopicTabId>>(() => new Set(['books']));
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTopic = useCallback(async () => {
    if (!topicId || !state.user) return;
    const { data, error } = await supabase
      .from('master_topics')
      .select('*')
      .eq('id', topicId)
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (error || !data) {
      navigate('/home', { replace: true });
      return;
    }

    setTopic(mapMasterTopic(data as MasterTopicRow));
    setIsLoading(false);
  }, [topicId, state.user, navigate]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  useEffect(() => {
    setMountedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    setActiveTab('books');
    setMountedTabs(new Set(['books']));
  }, [topicId]);

  async function handleDeleteTopic() {
    if (!state.user || !topic) return;
    const isConfirmed = window.confirm(
      `Delete "${topic.title}" and all books, chapters, notes, and extractions under it? This cannot be undone.`,
    );
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('master_topics').delete().eq('id', topic.id).eq('user_id', state.user.id);
      if (error) {
        window.alert(error.message);
        return;
      }
      navigate('/home', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      window.alert(message);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!state.user) {
    return <AuthenticatedSessionFallback />;
  }
  if (!topicId) {
    return <Navigate to="/home" replace />;
  }

  if (isLoading || !topic) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppHeader />
        <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading topic…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            All topics
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{topic.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              disabled={isDeleting}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteTopic()}
              disabled={isDeleting}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {isDeleting ? 'Deleting…' : 'Delete topic'}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <TopicTabNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className="mt-6 w-full">
          {mountedTabs.has('books') && (
            <div hidden={activeTab !== 'books'}>
              <BooksTab topicId={topicId} />
            </div>
          )}
          {mountedTabs.has('formulas') && (
            <div hidden={activeTab !== 'formulas'}>
              <FormulasTab topicId={topicId} />
            </div>
          )}
          {mountedTabs.has('definitions') && (
            <div hidden={activeTab !== 'definitions'}>
              <DefinitionsTab topicId={topicId} />
            </div>
          )}
          {mountedTabs.has('comparisons') && (
            <div hidden={activeTab !== 'comparisons'}>
              <ComparisonsTab topicId={topicId} />
            </div>
          )}
          {mountedTabs.has('summaries') && (
            <div hidden={activeTab !== 'summaries'}>
              <SummariesTab topicId={topicId} />
            </div>
          )}
        </div>
      </div>

      <EditTopicModal
        topic={topic}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onTopicUpdated={() => {
          void loadTopic();
        }}
      />
    </div>
  );
}
