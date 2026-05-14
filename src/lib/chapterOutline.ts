import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import type { Heading } from 'mdast';
import type { Paragraph } from '../types';
import { queryReadAlongMarkdownRoot } from './readAlongDomText';

export interface ChapterOutlineItem {
  paragraphId: string;
  /** Nth heading (0-based) inside this paragraph’s rendered markdown, matching DOM order. */
  headingIndex: number;
  level: number;
  label: string;
}

function paragraphDisplayText(p: Paragraph): string {
  return p.activeVersion === 'modified' && p.modified ? p.modified : p.original;
}

/** Strip common Markdown emphasis from outline labels for display. */
function outlineLabelFromPlain(raw: string): string {
  return raw.replace(/\*\*/g, '').replace(/\*([^*]+)\*/g, '$1').trim();
}

/**
 * Headings in remark AST order — matches react-markdown heading render order for the same string
 * (CommonMark), so outline indices align with rendered `data-heading-index` markers.
 */
function headingsFromMarkdownAst(markdown: string): { level: number; label: string }[] {
  const out: { level: number; label: string }[] = [];
  try {
    const tree = fromMarkdown(markdown);
    visit(tree, 'heading', (node: Heading) => {
      const raw = toString(node);
      const label = outlineLabelFromPlain(raw) || raw.trim() || 'Untitled section';
      out.push({ level: node.depth, label });
    });
  } catch {
    return out;
  }
  return out;
}

export function extractChapterOutline(paragraphs: Paragraph[]): ChapterOutlineItem[] {
  const items: ChapterOutlineItem[] = [];
  for (const p of paragraphs) {
    const text = paragraphDisplayText(p);
    const heads = headingsFromMarkdownAst(text);
    let headingIndex = 0;
    for (const h of heads) {
      items.push({
        paragraphId: p.id,
        headingIndex,
        level: h.level,
        label: h.label,
      });
      headingIndex += 1;
    }
  }
  return items;
}

/**
 * Resolves the heading inside a paragraph’s markdown root: prefer `data-heading-index`, else nth
 * `h1`–`h6` in DOM order (matches react-markdown output after lazy load).
 */
export function queryChapterHeadingElement(paragraphId: string, headingIndex: number): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const root = queryReadAlongMarkdownRoot(paragraphId);
  if (!root) {
    return null;
  }
  const byAttr = root.querySelector(`[data-heading-index="${String(headingIndex)}"]`);
  if (byAttr) {
    return byAttr;
  }
  const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  return headings.item(headingIndex) ?? null;
}

/** Last-resort: match visible heading text inside the reader article (handles index drift). */
export function queryChapterHeadingByLabelInReader(label: string): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const reader = document.querySelector('[data-reader-main]');
  if (!reader) {
    return null;
  }
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }
  const headings = reader.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of headings) {
    const text = h.textContent?.replace(/\s+/g, ' ').trim();
    if (text === normalized) {
      return h;
    }
  }
  return null;
}
