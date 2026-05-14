import type { ReadAlongSkipIncrementSec } from '../../lib/readAlongSkipPersist';
import { READ_ALONG_SKIP_INCREMENT_OPTIONS } from '../../lib/readAlongSkipPersist';

export interface ReadAlongToolbarProps {
  isSupported: boolean;
  isRunning: boolean;
  isPaused: boolean;
  canReadFromSelection: boolean;
  skipIncrementSec: ReadAlongSkipIncrementSec;
  onSkipIncrementSecChange: (value: ReadAlongSkipIncrementSec) => void;
  onPlayChapter: () => void;
  onPlayFromSelection: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipSeconds: (deltaSec: number) => void;
}

export function ReadAlongToolbar(props: ReadAlongToolbarProps) {
  const {
    isSupported,
    isRunning,
    isPaused,
    canReadFromSelection,
    skipIncrementSec,
    onSkipIncrementSecChange,
    onPlayChapter,
    onPlayFromSelection,
    onPause,
    onResume,
    onStop,
    onSkipSeconds,
  } = props;

  if (!isSupported) {
    return null;
  }

  const dockWrapClass =
    'pointer-events-auto fixed bottom-24 right-4 z-[55] w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-amber-200/90 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-amber-800/80 dark:bg-gray-900/95';
  const titleClass = 'text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200';
  const btnRowClass = 'mt-2 flex flex-wrap gap-2';
  const skipRowClass = 'mt-2 flex gap-1.5';
  const btnBaseClass =
    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-gray-950';
  const btnPrimaryClass = `${btnBaseClass} shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400`;
  const btnMutedClass = `${btnBaseClass} shrink-0 border border-amber-300 bg-white text-amber-950 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-800 dark:bg-gray-900 dark:text-amber-100 dark:hover:bg-gray-800 dark:disabled:opacity-40`;
  const btnSkipClass = `${btnBaseClass} min-w-0 flex-1 border border-amber-400/80 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/60`;
  const hintClass = 'mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400';
  const fieldsetClass = 'mt-2 border-0 p-0';
  const legendClass = 'text-[11px] font-medium text-gray-600 dark:text-gray-300';
  const radioRowClass = 'mt-1 flex flex-wrap gap-2';

  const skipBackLabel = `−${skipIncrementSec}s`;
  const skipAheadLabel = `+${skipIncrementSec}s`;
  const skipBackTitle = `Skip back about ${skipIncrementSec} seconds (estimated from speech pace)`;
  const skipAheadTitle = `Skip ahead about ${skipIncrementSec} seconds (estimated from speech pace)`;

  const skipBackHandler = () => {
    onSkipSeconds(-skipIncrementSec);
  };
  const skipAheadHandler = () => {
    onSkipSeconds(skipIncrementSec);
  };

  const inner = (
    <>
      <p className={titleClass}>Read aloud</p>
      <div className={btnRowClass} role="group" aria-label="Playback">
        {!isRunning ? (
          <>
            <button type="button" className={btnPrimaryClass} onClick={onPlayChapter}>
              Read chapter
            </button>
            <button
              type="button"
              className={btnMutedClass}
              onClick={onPlayFromSelection}
              disabled={!canReadFromSelection}
              title={canReadFromSelection ? 'Starts at your selected text' : 'Select text in the chapter first'}
            >
              From selection
            </button>
          </>
        ) : (
          <>
            {isPaused ? (
              <button type="button" className={btnPrimaryClass} onClick={onResume}>
                Resume
              </button>
            ) : (
              <button type="button" className={btnMutedClass} onClick={onPause}>
                Pause
              </button>
            )}
            <button type="button" className={btnMutedClass} onClick={onStop}>
              Stop
            </button>
          </>
        )}
      </div>

      {isRunning && (
        <div className={skipRowClass} role="group" aria-label="Time skip">
          <button type="button" className={btnSkipClass} title={skipBackTitle} onClick={skipBackHandler}>
            {skipBackLabel}
          </button>
          <button type="button" className={btnSkipClass} title={skipAheadTitle} onClick={skipAheadHandler}>
            {skipAheadLabel}
          </button>
        </div>
      )}

      {(!isRunning || isPaused) && (
        <fieldset className={fieldsetClass}>
          <legend className={legendClass}>Skip step (while reading)</legend>
          <div className={radioRowClass} role="radiogroup" aria-label="Skip step in seconds">
            {READ_ALONG_SKIP_INCREMENT_OPTIONS.map((opt) => {
              const id = `read-along-skip-${opt}`;
              const isChecked = skipIncrementSec === opt;
              return (
                <label
                  key={opt}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-xs text-gray-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500 dark:text-gray-200"
                >
                  <input
                    id={id}
                    type="radio"
                    name="read-along-skip-inc"
                    className="accent-amber-600"
                    checked={isChecked}
                    onChange={() => {
                      onSkipIncrementSecChange(opt);
                    }}
                  />
                  <span>{opt}s</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className={hintClass}>
        Word highlight uses CSS Highlight in Chrome/Edge (best). Safari/Firefox may be limited; pick an explicit Voice
        in Settings if the default voice keeps changing. ± skips use an estimated pace from speech boundaries.
      </p>
    </>
  );

  return (
    <div className={dockWrapClass} role="toolbar" aria-label="Read aloud">
      {inner}
    </div>
  );
}
