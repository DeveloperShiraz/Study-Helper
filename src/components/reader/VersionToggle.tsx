import type { Paragraph } from '../../types';

interface VersionToggleProps {
  paragraph: Paragraph;
  onSelect: (version: Paragraph['activeVersion']) => void;
}

export function VersionToggle({ paragraph, onSelect }: VersionToggleProps) {
  /** `modified` may be `""` after clearing text — still a real saved branch vs `null` (never edited). */
  if (paragraph.modified === null) {
    return null;
  }

  const baseBtn =
    'rounded-md px-2 py-1 text-xs font-medium ring-1 ring-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:ring-gray-600';
  const activeBtn = `${baseBtn} bg-indigo-600 text-white ring-indigo-600`;
  const inactiveBtn = `${baseBtn} bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800`;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        className={paragraph.activeVersion === 'original' ? activeBtn : inactiveBtn}
        onClick={() => onSelect('original')}
      >
        Original
      </button>
      <button
        type="button"
        className={paragraph.activeVersion === 'modified' ? activeBtn : inactiveBtn}
        onClick={() => onSelect('modified')}
      >
        Modified{paragraph.activeVersion === 'modified' ? ' (active)' : ''}
      </button>
    </div>
  );
}
