const PAGE_MARKER_PREFIX = '--- PDF page ';

export type ParsedChapterStarts = number[] | 'invalid';

export function validateChapterStartsAgainstPageCount(pageCount: number, starts: number[]): string | null {
  for (const p of starts) {
    if (p > pageCount) {
      return `Chapter start page ${p} is beyond this PDF (${pageCount} pages).`;
    }
  }
  return null;
}

/** Comma/whitespace-separated 1-based PDF page numbers where a new chapter begins. */
export function parseChapterStartPageList(input: string): ParsedChapterStarts {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number.parseInt(p, 10);
    if (!Number.isFinite(n) || n < 1) {
      return 'invalid';
    }
    nums.push(n);
  }
  const uniqueSorted = [...new Set(nums)].sort((a, b) => a - b);
  return uniqueSorted;
}

export interface ChapterPageRange {
  startPage: number;
  endPage: number;
}

const RANGE_TOKEN_PATTERN = /^(\d+)\s*[-–]\s*(\d+|END|end|\*)$/i;
const LONE_PAGE_TOKEN_PATTERN = /^(\d+)$/;

export interface ChapterRangeInputHighlight {
  start: number;
  end: number;
}

export type ChapterRangesParseResult =
  | { ok: true; ranges: ChapterPageRange[] }
  | { ok: false; reason: string; highlight?: ChapterRangeInputHighlight };

/** Split input into non-empty tokens (comma / semicolon / newline) with UTF-16 offsets into `input`. */
export function scanChapterRangeSegments(input: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  let i = 0;
  const len = input.length;
  while (i < len) {
    while (i < len && /[\s,;\n]/.test(input.charAt(i))) {
      i += 1;
    }
    if (i >= len) {
      break;
    }
    const tokenSliceStart = i;
    while (i < len && !/[\s,;\n]/.test(input.charAt(i))) {
      i += 1;
    }
    const slice = input.slice(tokenSliceStart, i);
    const text = slice.trim();
    if (text.length === 0) {
      continue;
    }
    const rel = slice.indexOf(text);
    const absStart = rel >= 0 ? tokenSliceStart + rel : tokenSliceStart;
    const absEnd = absStart + text.length;
    out.push({ text, start: absStart, end: absEnd });
  }
  return out;
}

/** Display list like `5–12, 13, 19–27` (en dash between start and end when different). */
export function formatChapterRangesSummary(ranges: ChapterPageRange[]): string {
  if (ranges.length === 0) {
    return '';
  }
  const parts = ranges.map((r) => {
    if (r.startPage === r.endPage) {
      return String(r.startPage);
    }
    return `${String(r.startPage)}\u2013${String(r.endPage)}`;
  });
  return parts.join(', ');
}

/**
 * Explicit page ranges, no overlaps. Ranges after the first must be consecutive (no gaps mid-document).
 * A leading gap is allowed: the first range may start after page 1 so you can append new chapters without
 * re-importing pages you already brought in (e.g. `37-50, 51-END`).
 * Use `158-END` (or `158-end` or `158-*`) for the last page through end of document.
 * A single page may be written as `28` or `28-28`.
 */
export function parseChapterPageRangesList(input: string, pageCount: number): ChapterRangesParseResult {
  const trimmed = input.trim();
  if (pageCount < 1) {
    return { ok: false, reason: 'Load a PDF first.' };
  }
  if (!trimmed) {
    return { ok: true, ranges: [{ startPage: 1, endPage: pageCount }] };
  }

  const segments = scanChapterRangeSegments(input);
  if (segments.length === 0) {
    return { ok: true, ranges: [{ startPage: 1, endPage: pageCount }] };
  }

  type Tagged = ChapterPageRange & { srcStart: number; srcEnd: number };
  const tagged: Tagged[] = [];

  for (const seg of segments) {
    const part = seg.text;
    const lone = part.match(LONE_PAGE_TOKEN_PATTERN);
    if (lone) {
      const n = Number.parseInt(lone[1], 10);
      if (!Number.isFinite(n) || n < 1 || n > pageCount) {
        return {
          ok: false,
          reason: `Page number out of range (this PDF has ${String(pageCount)} pages).`,
          highlight: { start: seg.start, end: seg.end },
        };
      }
      tagged.push({ startPage: n, endPage: n, srcStart: seg.start, srcEnd: seg.end });
      continue;
    }
    const m = part.match(RANGE_TOKEN_PATTERN);
    if (!m) {
      return {
        ok: false,
        reason:
          'This part is not a valid range. Use start-end (e.g. 5-12), one page as 7 or 7-7, or last chapter as 158-END.',
        highlight: { start: seg.start, end: seg.end },
      };
    }
    const startPage = Number.parseInt(m[1], 10);
    const endRaw = m[2];
    const endPage = /^(END|end|\*)$/i.test(endRaw) ? pageCount : Number.parseInt(endRaw, 10);
    if (
      !Number.isFinite(startPage) ||
      !Number.isFinite(endPage) ||
      startPage < 1 ||
      endPage < 1 ||
      startPage > pageCount ||
      endPage > pageCount ||
      startPage > endPage
    ) {
      return {
        ok: false,
        reason: 'Every range needs start ≤ end, and pages must be within this PDF.',
        highlight: { start: seg.start, end: seg.end },
      };
    }
    tagged.push({ startPage, endPage, srcStart: seg.start, srcEnd: seg.end });
  }

  const sorted = [...tagged].sort((a, b) => a.startPage - b.startPage || a.endPage - b.endPage);
  let cursor = 1;
  for (const r of sorted) {
    if (r.startPage < cursor) {
      return {
        ok: false,
        reason: `Overlapping ranges: page ${String(r.startPage)} is already covered (next unused page is ${String(cursor)}).`,
        highlight: { start: r.srcStart, end: r.srcEnd },
      };
    }
    if (r.startPage > cursor) {
      if (cursor !== 1) {
        return {
          ok: false,
          reason: `Missing pages ${String(cursor)}–${String(r.startPage - 1)}: add a range for those pages or attach them to the previous chapter.`,
          highlight: { start: r.srcStart, end: r.srcEnd },
        };
      }
    }
    cursor = r.endPage + 1;
  }
  if (cursor !== pageCount + 1) {
    const last = sorted[sorted.length - 1];
    const tail = last
      ? { start: last.srcStart, end: last.srcEnd }
      : { start: 0, end: 0 };
    return {
      ok: false,
      reason: `Ranges end at page ${String(cursor - 1)}; this PDF has ${String(pageCount)} pages. End the last chapter at ${String(pageCount)} or use END (e.g. ${String(Math.min(cursor, pageCount))}-END).`,
      highlight: tail,
    };
  }

  const ranges: ChapterPageRange[] = sorted.map(({ startPage, endPage }) => ({ startPage, endPage }));
  return { ok: true, ranges };
}

/**
 * First PDF page of each new chapter (1-based). Example `5,13,19,28` → segments
 * pages 1–4, 5–12, 13–18, 19–27, 28–end. Empty list → one segment for the whole PDF.
 */
export function buildChapterPageRanges(pageCount: number, sortedChapterStarts: number[]): ChapterPageRange[] {
  if (pageCount < 1) {
    return [];
  }
  if (sortedChapterStarts.length === 0) {
    return [{ startPage: 1, endPage: pageCount }];
  }

  const validStarts = sortedChapterStarts.filter((p) => p >= 1 && p <= pageCount);
  if (validStarts.length === 0) {
    return [{ startPage: 1, endPage: pageCount }];
  }

  const ranges: ChapterPageRange[] = [];
  let cursor = 1;
  for (const startPage of validStarts) {
    if (startPage > cursor) {
      ranges.push({ startPage: cursor, endPage: startPage - 1 });
    }
    cursor = startPage;
  }
  if (cursor <= pageCount) {
    ranges.push({ startPage: cursor, endPage: pageCount });
  }
  return ranges;
}

export function formatSegmentPlainText(pageTexts: string[], range: ChapterPageRange): string {
  const chunks: string[] = [];
  for (let p = range.startPage; p <= range.endPage; p++) {
    const idx = p - 1;
    const body = pageTexts[idx] ?? '';
    chunks.push(`${PAGE_MARKER_PREFIX}${p} ---\n${body}`);
  }
  return chunks.join('\n\n').trim();
}
