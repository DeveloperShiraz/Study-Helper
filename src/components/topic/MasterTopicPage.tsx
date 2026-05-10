import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mapMasterTopic, type MasterTopicRow } from '../../lib/dbMappers';
import { useApp } from '../../context/AppContext';
import type { MasterTopic } from '../../types';
import AppHeader from '../layout/AppHeader';
import { TopicTabNav, type TopicTabId } from './TopicTabNav';
import { BooksTab } from './tabs/BooksTab';
import { FormulasTab } from './tabs/FormulasTab';
import { DefinitionsTab } from './tabs/DefinitionsTab';
import { ComparisonsTab } from './tabs/ComparisonsTab';
import { SummariesTab } from './tabs/SummariesTab';

export function MasterTopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { state } = useApp();
  const [topic, setTopic] = useState<MasterTopic | null>(null);
  const [activeTab, setActiveTab] = useState<TopicTabId>('books');
  const [isLoading, setIsLoading] = useState(true);

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

  if (!state.user || !topicId) return null;

  if (isLoading || !topic) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="p-8 text-center text-gray-600">Loading topic…</div>
      </div>
    );
  }

  let tabContent = null;
  if (activeTab === 'books') {
    tabContent = <BooksTab topicId={topicId} />;
  } else if (activeTab === 'formulas') {
    tabContent = <FormulasTab topicId={topicId} />;
  } else if (activeTab === 'definitions') {
    tabContent = <DefinitionsTab topicId={topicId} />;
  } else if (activeTab === 'comparisons') {
    tabContent = <ComparisonsTab topicId={topicId} />;
  } else if (activeTab === 'summaries') {
    tabContent = <SummariesTab topicId={topicId} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">{topic.title}</h1>
        <div className="mt-4">
          <TopicTabNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{tabContent}</div>
      </div>
    </div>
  );
}
