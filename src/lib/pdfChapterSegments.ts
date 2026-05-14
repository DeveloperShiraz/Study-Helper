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
