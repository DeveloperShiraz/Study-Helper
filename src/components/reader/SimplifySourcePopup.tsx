import { useEffect, useState } from 'react';
import { useAI } from '../../hooks/useAI';
import { useApp } from '../../context/AppContext';
import { parseSimplifyAB } from './parseSimplifyVersions';

interface SimplifySourcePopupProps {
  sourceText: string;
  onDismiss: () => void;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text.trim()) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function SimplifySourcePopup({ sourceText, onDismiss }: SimplifySourcePopupProps) {
  const { state } = useApp();
  const { simplify, isLoading, error } = useAI();
  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');
  const [copyHint, setCopyHint] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      if (!state.settings) return;
      try {
        const raw = await simplify(sourceText, state.settings);
        if (isCancelled) return;
        const parsed = parseSimplifyAB(raw);
        setVersionA(parsed.versionA);
        setVersionB(parsed.versionB);
      } catch {
        /* error surfaced via hook */
      }
    }

    void run();

    return () => {
      isCancelled = true;
    };
  }, [sourceText, simplify, state.settings]);

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
          {copyHint ? (
            <p className="text-xs text-stone-600 dark:text-stone-300" role="status">
              {copyHint}
            </p>
          ) : null}

          <div className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Original</p>
            <p className="mt-2 whitespace-pre-wrap">{sourceText}</p>
          </div>

          <div className={sectionClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Version A</p>
            <p className="mt-2 whitespace-pre-wrap">{isLoading ? 'Generating…' : versionA}</p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!versionA || isLoading}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                onClick={() => {
                  void copyToClipboard(versionA).then((ok) => {
                    setCopyHint(ok ? 'Copied version A.' : 'Could not copy to clipboard.');
                  });
                }}
              >
                Copy
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
                onClick={() => {
                  void copyToClipboard(versionB).then((ok) => {
                    setCopyHint(ok ? 'Copied version B.' : 'Could not copy to clipboard.');
                  });
                }}
              >
                Copy
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isLoading || !state.settings}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                void (async () => {
                  if (!state.settings) return;
                  try {
                    const raw = await simplify(sourceText, state.settings);
                    const parsed = parseSimplifyAB(raw);
                    setVersionA(parsed.versionA);
                    setVersionB(parsed.versionB);
                  } catch {
                    /* handled in hook */
                  }
                })();
              }}
            >
              Simplify again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
