import { useMemo } from 'react';
import { MarkdownWithMath } from './MarkdownWithMath';
import { ParagraphStudyRail } from './ParagraphStudyRail';

const lineBlockClass =
  'group relative rounded-lg border border-transparent px-3 py-3 hover:border-amber-200/60 dark:hover:border-stone-600/50';

const markdownBodyClass =
  'flex-1 min-w-0 space-y-2 text-stone-800 dark:text-stone-200 [&_code]:rounded [&_code]:bg-amber-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] dark:[&_code]:bg-stone-800 dark:[&_code]:text-stone-100 [&_a]:text-amber-700 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-amber-400';

interface ExtractionLineStudyBlockProps {
  itemId: string;
  markdownText: string;
  hasPinnedNote: boolean;
  hasSettings: boolean;
  isAiBusy: boolean;
  canReadAloud: boolean;
  isReadAloudDisabled: boolean;
  onExplain: () => void;
  onSimplify: () => void;
  onPin: () => void;
  onReadAloud: () => void;
}

export function ExtractionLineStudyBlock({
  itemId,
  markdownText,
  hasPinnedNote,
  hasSettings,
  isAiBusy,
  canReadAloud,
  isReadAloudDisabled,
  onExplain,
  onSimplify,
  onPin,
  onReadAloud,
}: ExtractionLineStudyBlockProps) {
  const lineKey = useMemo(() => `extraction-line-${itemId}`, [itemId]);

  return (
    <div className={lineBlockClass} data-extraction-line-id={lineKey}>
      <div className="flex flex-wrap items-start gap-2 sm:gap-3">
        <div className={`${markdownBodyClass} min-w-0 flex-1`}>
          <MarkdownWithMath>{markdownText}</MarkdownWithMath>
        </div>
        <ParagraphStudyRail
          hasPinnedNote={hasPinnedNote}
          isAiBusy={isAiBusy}
          hasSettings={hasSettings}
          canReadAloud={canReadAloud}
          isReadAloudDisabled={isReadAloudDisabled}
          onExplain={onExplain}
          onSimplify={onSimplify}
          onPin={onPin}
          onReadAloud={canReadAloud ? onReadAloud : undefined}
        />
      </div>
    </div>
  );
}
