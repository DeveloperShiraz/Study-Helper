interface SelectionToolbarProps {
  top: number;
  left: number;
  onExplain: () => void;
  onSimplify: () => void;
  onPinNote: () => void;
  onReadAloud?: () => void;
  isReadAloudDisabled?: boolean;
}

export function SelectionToolbar({
  top,
  left,
  onExplain,
  onSimplify,
  onPinNote,
  onReadAloud,
  isReadAloudDisabled = true,
}: SelectionToolbarProps) {
  const style = { top, left };

  const btnClass =
    'rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-800 shadow ring-1 ring-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-800 dark:disabled:opacity-40';

  return (
    <div
      className="fixed z-40 flex gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-gray-200 dark:bg-gray-900/95 dark:ring-gray-600"
      style={style}
      role="toolbar"
      aria-label="Text actions"
    >
      <button type="button" className={btnClass} onClick={onExplain}>
        Explain
      </button>
      <button type="button" className={btnClass} onClick={onSimplify}>
        Simplify
      </button>
      <button type="button" className={btnClass} onClick={onPinNote}>
        Pin Note
      </button>
      {onReadAloud ? (
        <button type="button" className={btnClass} onClick={onReadAloud} disabled={isReadAloudDisabled}>
          Read aloud
        </button>
      ) : null}
    </div>
  );
}
