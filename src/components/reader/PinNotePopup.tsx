import { useState, type FormEvent } from 'react';

interface PinNotePopupProps {
  initialNote: string;
  onSave: (note: string) => void;
  onDismiss: () => void;
}

export function PinNotePopup({ initialNote, onSave, onDismiss }: PinNotePopupProps) {
  const [note, setNote] = useState(initialNote);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(note.trim());
  }

  const panelClass =
    'relative z-50 w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Dismiss" onClick={onDismiss} />
      <form className={panelClass} onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pin note</h3>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onDismiss}
          >
            Close
          </button>
        </div>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            onClick={onDismiss}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
