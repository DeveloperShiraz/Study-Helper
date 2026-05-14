import { useEffect, useState } from 'react';
import { useAI } from '../../hooks/useAI';
import { useApp } from '../../context/AppContext';
import { parseSimplifyAB } from './parseSimplifyVersions';
import type { Paragraph } from '../../types';

interface SimplifyPopupProps {
  paragraph: Paragraph;
  onUseOriginal: () => void;
  onUseModified: (text: string) => void;
  onDismiss: () => void;
}

export function SimplifyPopup({ paragraph, onUseOriginal, onUseModified, onDismiss }: SimplifyPopupProps) {
  const { state } = useApp();
  const { simplify, isLoading, error } = useAI();
  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');
  const activeSource =
    paragraph.activeVersion === 'modified' && paragraph.modified ? paragraph.modified : paragraph.original;

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      if (!state.settings) return;
      try {
        const raw = await simplify(activeSource, state.settings);
        if (isCancelled) return;
        const parsed = parseSimplifyAB(raw);
        setVersionA(parsed.versionA);
        setVersionB(parsed.versionB);
      } catch {
        /* error surfaced via hook */
      }
    }

    run();

    return () => {
      isCancelled = true;
    };
  }, [activeSource, simplify, state.settings]);

  const panelClass =
    'relative z-50 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900';

  const sectionClass =
    'rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Dismiss" onClick={onDismiss} />
      <div className={panelClass}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Simplify</h3>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onDismiss}
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className={sectionClass}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Original</p>
              <button
                type="button"
                className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-800"
                onClick={onUseOriginal}
              >
                Use Original
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{paragraph.original}</p>
          </div>

          <div className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Version A</p>
            <p className="mt-2 whitespace-pre-wrap">{isLoading ? 'Generating…' : versionA}</p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!versionA || isLoading}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                onClick={() => onUseModified(versionA)}
              >
                Use This
              </button>
            </div>
          </div>

          <div className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Version B</p>
            <p className="mt-2 whitespace-pre-wrap">{isLoading ? 'Generating…' : versionB}</p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!versionB || isLoading}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                onClick={() => onUseModified(versionB)}
              >
                Use This
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isLoading || !state.settings}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
              onClick={async () => {
                if (!state.settings) return;
                try {
                  const raw = await simplify(activeSource, state.settings);
                  const parsed = parseSimplifyAB(raw);
                  setVersionA(parsed.versionA);
                  setVersionB(parsed.versionB);
                } catch {
                  /* handled in hook */
                }
              }}
            >
              Simplify Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
