import { useState, useEffect, useCallback } from 'react';

interface SelectionState {
  text: string;
  rect: DOMRect | null;
}

export function useTextSelection() {
  const [selection, setSelection] = useState<SelectionState>({ text: '', rect: null });

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection({ text: '', rect: null });
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelection({ text: sel.toString().trim(), rect });
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: '', rect: null });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('keyup', handleSelection);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSelection, clearSelection]);

  return { selection, clearSelection };
}
