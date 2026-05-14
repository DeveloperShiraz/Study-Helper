import type { ChapterOutlineItem } from '../../lib/chapterOutline';
import {
  queryChapterHeadingByLabelInReader,
  queryChapterHeadingElement,
} from '../../lib/chapterOutline';
import { flashOutlineJumpTarget } from '../../lib/outlineJumpHighlight';

interface ChapterOutlineNavProps {
  items: ChapterOutlineItem[];
}

const outlineNavClass =
  'sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900';
const outlineHeadingClass = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const outlineButtonBaseClass =
  'w-full rounded-md px-2 py-1.5 text-left text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800';
const mobileDetailsClass =
  'mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:hidden';

const SCROLL_OUTLINE_MAX_ATTEMPTS = 40;
const SCROLL_OUTLINE_ATTEMPT_MS = 100;

function scrollToChapterHeading(paragraphId: string, headingIndex: number, label: string): void {
  let attempts = 0;

  function tryScroll(): void {
    const el =
      queryChapterHeadingElement(paragraphId, headingIndex) ?? queryChapterHeadingByLabelInReader(label);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashOutlineJumpTarget(el);
      return;
    }
    attempts += 1;
    if (attempts < SCROLL_OUTLINE_MAX_ATTEMPTS) {
      window.setTimeout(tryScroll, SCROLL_OUTLINE_ATTEMPT_MS);
    }
  }

  tryScroll();
}

interface OutlineNavRowProps {
  item: ChapterOutlineItem;
  outlineButtonBaseClass: string;
}

function OutlineNavRow({ item, outlineButtonBaseClass }: OutlineNavRowProps) {
  const indentPx = Math.max(0, item.level - 2) * 10;
  const listRowStyle = { paddingLeft: indentPx };
  const isSmallHeading = item.level >= 3;
  const lineButtonClass = isSmallHeading
    ? `${outlineButtonBaseClass} cursor-pointer text-[13px] text-gray-600 dark:text-gray-300`
    : `${outlineButtonBaseClass} cursor-pointer`;

  function handleActivate(): void {
    scrollToChapterHeading(item.paragraphId, item.headingIndex, item.label);
  }

  return (
    <li style={listRowStyle}>
      <button type="button" className={lineButtonClass} onClick={handleActivate}>
        {item.label}
      </button>
    </li>
  );
}

export function ChapterOutlineNav({ items }: ChapterOutlineNavProps) {
  const emptyHint = (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      No Markdown headings found. Start lines with ## or ### in the chapter text (for example after AI PDF import) to
      build this outline.
    </p>
  );

  if (items.length === 0) {
    return (
      <>
        <details className={mobileDetailsClass}>
          <summary className="cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-100">
            Jump to section
          </summary>
          <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">{emptyHint}</div>
        </details>
        <div className={`${outlineNavClass} hidden lg:block`}>
          <p className={outlineHeadingClass}>On this page</p>
          <div className="mt-2">{emptyHint}</div>
        </div>
      </>
    );
  }

  const listContent = (
    <ul className="mt-2 space-y-0.5">
      {items.map((item) => (
        <OutlineNavRow
          key={`${item.paragraphId}-${item.headingIndex}`}
          item={item}
          outlineButtonBaseClass={outlineButtonBaseClass}
        />
      ))}
    </ul>
  );

  return (
    <>
      <details className={mobileDetailsClass}>
        <summary className="cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-100">
          Jump to section
        </summary>
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">{listContent}</div>
      </details>

      <nav aria-label="Chapter outline" className={`${outlineNavClass} hidden lg:block`}>
        <p className={outlineHeadingClass}>On this page</p>
        {listContent}
      </nav>
    </>
  );
}
