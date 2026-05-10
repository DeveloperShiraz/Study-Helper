interface SelectionToolbarProps {
  top: number;
  left: number;
  onExplain: () => void;
  onSimplify: () => void;
  onPinNote: () => void;
}

export function SelectionToolbar({ top, left, onExplain, onSimplify, onPinNote }: SelectionToolbarProps) {
  const style = { top, left };

  const btnClass =
    'rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-800 shadow ring-1 ring-gray-200 hover:bg-gray-50';

  return (
    <div
      className="fixed z-40 flex gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-gray-200"
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
    </div>
  );
}
