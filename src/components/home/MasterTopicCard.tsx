import type { MasterTopic } from '../../types';

interface MasterTopicCardProps {
  topic: MasterTopic;
  onClick: () => void;
}

export function MasterTopicCard({ topic, onClick }: MasterTopicCardProps) {
  const createdDate = new Date(topic.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <h3 className="text-lg font-semibold text-gray-900">{topic.title}</h3>
      <p className="mt-1 text-sm text-gray-500">Created {createdDate}</p>
    </button>
  );
}
