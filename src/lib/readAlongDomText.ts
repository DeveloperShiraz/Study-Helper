/** Root that wraps the rendered markdown for a paragraph (excludes chrome like Pin). */
export const READ_ALONG_ROOT_SELECTOR = '[data-read-along-root]';

export function queryReadAlongMarkdownRoot(paragraphId: string): HTMLElement | null {
  const el = document.querySelector(
    `[data-paragraph-id="${CSS.escape(paragraphId)}"] ${READ_ALONG_ROOT_SELECTOR}`,
  );
  return el instanceof HTMLElement ? el : null;
}

export type ReadAlongTextSegment = { node: Text; len: number };

/**
 * Plain string and text nodes in document order — must match Range.toString() for the same root
 * so speech boundaries align with the visible article.
 */
export function collectReadAlongDomSegments(root: HTMLElement): { full: string; segments: ReadAlongTextSegment[] } {
  const segments: ReadAlongTextSegment[] = [];
  let full = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const val = t.nodeValue ?? '';
    if (val.length === 0) {
      continue;
    }
    segments.push({ node: t, len: val.length });
    full += val;
  }
  return { full, segments };
}

export function mapGlobalCharToTextOffset(
  segments: ReadAlongTextSegment[],
  globalChar: number,
): { node: Text; offset: number } | null {
  let at = 0;
  for (const seg of segments) {
    if (globalChar < at + seg.len) {
      return { node: seg.node, offset: globalChar - at };
    }
    if (globalChar === at + seg.len) {
      return { node: seg.node, offset: seg.len };
    }
    at += seg.len;
  }
  if (globalChar === at && segments.length > 0) {
    const last = segments[segments.length - 1];
    return { node: last.node, offset: last.len };
  }
  return null;
}

/** Start of selection in root document order (inclusive), in the same coordinate system as collectReadAlongDomSegments. */
export function domSelectionStartOffsetInRoot(root: HTMLElement, sel: Selection): number | null {
  if (sel.rangeCount === 0) {
    return null;
  }
  const sr = sel.getRangeAt(0);
  if (!root.contains(sr.startContainer) || !root.contains(sr.endContainer)) {
    return null;
  }
  const toStart = document.createRange();
  toStart.selectNodeContents(root);
  toStart.setEnd(sr.startContainer, sr.startOffset);
  const a = toStart.toString().length;
  const toEnd = document.createRange();
  toEnd.selectNodeContents(root);
  toEnd.setEnd(sr.endContainer, sr.endOffset);
  const b = toEnd.toString().length;
  return Math.min(a, b);
}

const READ_ALONG_HIGHLIGHT_NAME = 'study-helper-read-along';

export function clearReadAlongCssHighlight(): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS) || !CSS.highlights) {
    return;
  }
  CSS.highlights.delete(READ_ALONG_HIGHLIGHT_NAME);
}

export function applyReadAlongCssHighlight(range: Range): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS) || !CSS.highlights) {
    return;
  }
  const clone = document.createRange();
  clone.setStart(range.startContainer, range.startOffset);
  clone.setEnd(range.endContainer, range.endOffset);
  CSS.highlights.set(READ_ALONG_HIGHLIGHT_NAME, new Highlight(clone));
}

export { READ_ALONG_HIGHLIGHT_NAME };
