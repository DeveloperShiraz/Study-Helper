import type { MasterTopic } from '../../types';

interface MasterTopicCardProps {
  topic: MasterTopic;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const BTN_GHOST =
  'rounded-lg px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800';
const BTN_DANGER =
  'rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40';

export function MasterTopicCard({ topic, onOpen, onEdit, onDelete }: MasterTopicCardProps) {
  const createdDate = new Date(topic.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-500">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-lg"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{topic.title}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Created {createdDate}</p>
      </button>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <button type="button" className={BTN_GHOST} onClick={onEdit}>
          Rename
        </button>
        <button type="button" className={BTN_DANGER} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
