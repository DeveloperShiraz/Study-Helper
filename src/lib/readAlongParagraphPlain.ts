import type { Paragraph } from '../types';
import { markdownToSpeakableText } from './markdownToSpeakable';
import { collectReadAlongDomSegments, queryReadAlongMarkdownRoot } from './readAlongDomText';

/** Markdown-only plain (fallback when the paragraph DOM is not available). */
export function paragraphPlain(p: Paragraph): string {
  const raw = p.activeVersion === 'modified' ? (p.modified ?? p.original) : p.original;
  return markdownToSpeakableText(raw);
}

/** Plain string aligned with visible markdown (DOM when possible). */
export function readAlongPlainForParagraph(p: Paragraph): string {
  const root = queryReadAlongMarkdownRoot(p.id);
  const domCollected = root ? collectReadAlongDomSegments(root) : null;
  const domPlain = domCollected && domCollected.full.length > 0 ? domCollected.full : null;
  return domPlain ?? paragraphPlain(p);
}
