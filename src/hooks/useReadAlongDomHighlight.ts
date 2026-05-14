import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { ReadAlongHighlight } from './useReadAlong';
import {
  applyReadAlongCssHighlight,
  clearReadAlongCssHighlight,
  collectReadAlongDomSegments,
  mapGlobalCharToTextOffset,
} from '../lib/readAlongDomText';

export function useReadAlongDomHighlight(
  paragraphId: string,
  readAlongHighlight: ReadAlongHighlight | null | undefined,
  rootRef: RefObject<HTMLElement | null>,
) {
  const fallbackMarkRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const highlight = readAlongHighlight;

    function cleanup() {
      clearReadAlongCssHighlight();
      const mark = fallbackMarkRef.current;
      fallbackMarkRef.current = null;
      if (mark?.parentNode) {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      }
    }

    if (!root || !highlight) {
      return undefined;
    }
    if (highlight.paragraphId !== paragraphId) {
      return undefined;
    }

    const h: ReadAlongHighlight = highlight;
    const { full, segments } = collectReadAlongDomSegments(root);
    let endClamp = Math.min(h.charEnd, full.length);
    let startClamp = Math.max(0, Math.min(h.charStart, endClamp));
    if (endClamp <= startClamp && startClamp < full.length) {
      endClamp = Math.min(startClamp + 1, full.length);
    }
    if (endClamp <= startClamp) {
      return undefined;
    }

    const startPos = mapGlobalCharToTextOffset(segments, startClamp);
    const endPos = mapGlobalCharToTextOffset(segments, endClamp);
    if (!startPos || !endPos) {
      return undefined;
    }

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    const hasCssHighlights =
      typeof CSS !== 'undefined' && 'highlights' in CSS && Boolean(CSS.highlights);

    if (hasCssHighlights) {
      applyReadAlongCssHighlight(range);
      return cleanup;
    }

    if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      const mark = document.createElement('mark');
      mark.className = 'read-along-fallback-mark';
      fallbackMarkRef.current = mark;
      try {
        range.surroundContents(mark);
      } catch {
        fallbackMarkRef.current = null;
      }
      return cleanup;
    }

    return cleanup;
  }, [
    paragraphId,
    readAlongHighlight?.paragraphId,
    readAlongHighlight?.charStart,
    readAlongHighlight?.charEnd,
    rootRef,
  ]);
}
