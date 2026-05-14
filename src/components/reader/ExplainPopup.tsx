interface ExplainPopupProps {
  explanation: string;
  onPin: () => void;
  onDismiss: () => void;
}

export function ExplainPopup({ explanation, onPin, onDismiss }: ExplainPopupProps) {
  const panelClass =
    'relative z-50 w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Dismiss" onClick={onDismiss} />
      <div className={panelClass}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Explanation</h3>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onDismiss}
          >
            Close
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{explanation}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={onPin}
          >
            Pin This
          </button>
        </div>
      </div>
    </div>
  );
}
