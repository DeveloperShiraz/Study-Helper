interface ParagraphStudyRailProps {
  hasPinnedNote: boolean;
  isAiBusy: boolean;
  hasSettings: boolean;
  canReadAloud: boolean;
  isReadAloudDisabled: boolean;
  onExplain: () => void;
  onSimplify: () => void;
  onPin: () => void;
  onReadAloud?: () => void;
}

const settingsHint = 'Open Settings and add your AI preferences to use this.';

function IconBtn({
  title,
  disabled,
  onClick,
  children,
  amber,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  amber?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        'ring-1 focus:outline-none focus:ring-2 focus:ring-amber-400',
        amber
          ? 'bg-amber-50 text-amber-700 ring-amber-300/80 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-700/60 dark:hover:bg-amber-900/50'
          : 'bg-stone-50 text-stone-500 ring-stone-200 hover:bg-white hover:text-stone-800 dark:bg-stone-900/60 dark:text-stone-400 dark:ring-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200',
        'disabled:cursor-not-allowed disabled:opacity-40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function ParagraphStudyRail({
  hasPinnedNote,
  isAiBusy,
  hasSettings,
  canReadAloud,
  isReadAloudDisabled,
  onExplain,
  onSimplify,
  onPin,
  onReadAloud,
}: ParagraphStudyRailProps) {
  return (
    <div
      className="flex shrink-0 flex-row gap-1 border-t border-stone-100 pt-2 sm:flex-col sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0 md:sticky md:top-20"
      role="toolbar"
      aria-label="Paragraph study tools"
    >
      {/* Explain */}
      <IconBtn
        title={hasSettings ? 'Explain this paragraph' : settingsHint}
        disabled={isAiBusy || !hasSettings}
        onClick={onExplain}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
        </svg>
      </IconBtn>

      {/* Simplify */}
      <IconBtn
        title={hasSettings ? 'Simplify this paragraph' : settingsHint}
        disabled={isAiBusy || !hasSettings}
        onClick={onSimplify}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path fillRule="evenodd" d="M13.5 4.938a7 7 0 11-9.006 1.737c.202-.257.59-.218.793.039.203.257.164.638-.038.95a5.5 5.5 0 107.396-1.313c-.208-.185-.264-.55-.108-.803l.33-.531a.538.538 0 01.633-.079z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M8.25 7.75A.75.75 0 019 7h2a.75.75 0 01.75.75v1.5h.5a.75.75 0 010 1.5h-5a.75.75 0 010-1.5h.5v-1.5A.75.75 0 018.25 7.75z" clipRule="evenodd" />
        </svg>
      </IconBtn>

      {/* Pin */}
      <IconBtn
        title={hasPinnedNote ? 'Edit pinned note' : 'Pin a note'}
        disabled={isAiBusy}
        onClick={onPin}
        amber={hasPinnedNote}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M9.414 16H5a1 1 0 01-1-1v-4a1 1 0 011-1h1.586L10 6.586V17.4l-.586-1.4zM14 7.414L10.586 4H15a1 1 0 011 1v4a1 1 0 01-1 1h-1v-.586zM10 17.414l.586 1.4A1 1 0 0112 20h-4a1 1 0 011.414-.293L10 17.414z" />
          <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14z" />
        </svg>
      </IconBtn>

      {/* Read aloud */}
      {canReadAloud && onReadAloud && (
        <IconBtn
          title="Read this paragraph aloud"
          disabled={isReadAloudDisabled}
          onClick={onReadAloud}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </IconBtn>
      )}
    </div>
  );
}
