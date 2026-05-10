const TAB_ITEMS = [
  { id: 'books', label: 'Books' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'definitions', label: 'Definitions' },
  { id: 'comparisons', label: 'Comparisons' },
  { id: 'summaries', label: 'Summaries' },
] as const;

export type TopicTabId = (typeof TAB_ITEMS)[number]['id'];

interface TopicTabNavProps {
  activeTab: TopicTabId;
  onTabChange: (tab: TopicTabId) => void;
}

export function TopicTabNav({ activeTab, onTabChange }: TopicTabNavProps) {
  const tabListClass = 'flex flex-wrap gap-2 border-b border-gray-200 px-4 pb-2';
  const baseTabClass =
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';
  const inactiveTabClass = `${baseTabClass} text-gray-600 hover:bg-gray-100`;
  const activeTabClass = `${baseTabClass} bg-indigo-100 text-indigo-900`;

  return (
    <nav className={tabListClass} aria-label="Topic sections">
      {TAB_ITEMS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            className={isActive ? activeTabClass : inactiveTabClass}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
