import { useEffect, useState } from 'react';
import type { ChapterOutlineItem } from '../../lib/chapterOutline';
import {
  queryChapterHeadingByLabelInReader,
  queryChapterHeadingElement,
} from '../../lib/chapterOutline';
import { flashOutlineJumpTarget } from '../../lib/outlineJumpHighlight';

interface ChapterOutlineNavProps {
  items: ChapterOutlineItem[];
}

const SCROLL_OUTLINE_MAX_ATTEMPTS = 40;
const SCROLL_OUTLINE_ATTEMPT_MS = 100;

function itemKey(item: ChapterOutlineItem): string {
  return `${item.paragraphId}-${item.headingIndex}`;
}

/** Pixels from viewport top where a navigated heading lands. Must be < SCROLL_SPY_OFFSET so the spy treats it as active. */
const SCROLL_TARGET_TOP_PX = 100;

function scrollToChapterHeading(paragraphId: string, headingIndex: number, label: string): void {
  let attempts = 0;
  function tryScroll(): void {
    const el =
      queryChapterHeadingElement(paragraphId, headingIndex) ?? queryChapterHeadingByLabelInReader(label);
    if (el) {
      const targetY = el.getBoundingClientRect().top + window.scrollY - SCROLL_TARGET_TOP_PX;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
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
  isActive: boolean;
  onNavigate: (key: string) => void;
}

function OutlineNavRow({ item, isActive, onNavigate }: OutlineNavRowProps) {
  const key = itemKey(item);

  return (
    <li className="break-inside-avoid mb-0.5">
      <button
        type="button"
        data-outline-key={key}
        onClick={() => {
          onNavigate(key);
          scrollToChapterHeading(item.paragraphId, item.headingIndex, item.label);
        }}
        className={[
          'w-full rounded-md px-2 py-1 text-left leading-snug transition-all duration-150',
          isActive
            ? 'border border-yellow-400/70 bg-yellow-300/90 font-semibold text-yellow-900 dark:border-yellow-500/60 dark:bg-yellow-400/20 dark:text-yellow-200'
            : 'border border-stone-200 bg-stone-50/80 text-stone-600 hover:border-amber-300/80 hover:bg-amber-50 hover:text-amber-900 dark:border-stone-700/70 dark:bg-stone-800/40 dark:text-stone-400 dark:hover:border-amber-600/50 dark:hover:bg-amber-950/30 dark:hover:text-amber-200',
        ].join(' ')}
        style={{
          boxShadow: isActive
            ? '0 0 0 1px #fbbf24, 0 0 10px rgba(251,191,36,0.5), 0 0 24px rgba(251,191,36,0.2)'
            : undefined,
        }}
      >
        {item.label}
      </button>
    </li>
  );
}

/** Offset from viewport top (px) used to decide which heading is "active" while scrolling. */
const SCROLL_SPY_OFFSET = 130;

export function ChapterOutlineNav({ items }: ChapterOutlineNavProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    function updateActive() {
      const threshold = window.scrollY + SCROLL_SPY_OFFSET;
      let found: string | null = null;
      for (const item of items) {
        const el =
          queryChapterHeadingElement(item.paragraphId, item.headingIndex) ??
          queryChapterHeadingByLabelInReader(item.label);
        if (!el) continue;
        if (el.getBoundingClientRect().top + window.scrollY <= threshold) {
          found = itemKey(item);
        }
      }
      if (!found && items.length > 0) {
        found = itemKey(items[0]);
      }
      setActiveKey(found);
    }

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    return () => window.removeEventListener('scroll', updateActive);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Chapter outline"
      className="sticky top-20 rounded-xl border border-amber-100/80 bg-[#faf8f4] p-3 shadow-sm dark:border-stone-700/60 dark:bg-[#1e1c18]"
      style={{
        fontSize: 'var(--study-helper-outline-font, 12px)',
        fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
      }}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700/80 dark:text-amber-500/80">
        <span className="inline-block h-3 w-0.5 rounded-full bg-amber-400/70 dark:bg-amber-500/60" aria-hidden="true" />
        On this page
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <OutlineNavRow
            key={itemKey(item)}
            item={item}
            isActive={itemKey(item) === activeKey}
            onNavigate={setActiveKey}
          />
        ))}
      </ul>
    </nav>
  );
}
