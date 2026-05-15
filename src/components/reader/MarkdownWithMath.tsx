import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkMath from 'remark-math';
import { rehypeNormalizeChildLists } from '../../lib/rehypeNormalizeChildLists';
import { MarkdownMathErrorBoundary } from './MarkdownMathErrorBoundary';
import { mergeMarkdownComponentsWithMath } from './mergeMarkdownComponentsWithMath';

const readerMarkdownRemarkPlugins = [remarkMath];
const readerMarkdownRehypePlugins = [rehypeNormalizeChildLists];

const markdownFallbackWrapClass =
  'rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50';
const markdownFallbackTitleClass = 'font-medium';
const markdownFallbackHintClass = 'mt-1 text-xs text-amber-900/80 dark:text-amber-200/80';
const markdownFallbackPreClass =
  'mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-amber-900/20 bg-white/80 p-2 font-mono text-xs text-gray-800 dark:border-amber-200/20 dark:bg-gray-950/50 dark:text-gray-100';

export interface MarkdownWithMathProps {
  children?: string | null;
  components?: Components;
  className?: string;
}

/**
 * Markdown + inline/display math ($…$, $$…$$) via KaTeX. Used by the chapter reader and topic extraction cards.
 * Math is rendered in a custom `code` component (no `rehype-katex`). HAST child lists are normalized so markdown’s
 * internal tree walk does not throw on `undefined` slots.
 */
export function MarkdownWithMath({ children, components, className }: MarkdownWithMathProps) {
  const markdownSource = typeof children === 'string' ? children : '';
  const mergedComponents = useMemo(() => mergeMarkdownComponentsWithMath(components), [components]);
  const markdownErrorFallback = useMemo(
    () => (
      <div className={markdownFallbackWrapClass}>
        <p className={markdownFallbackTitleClass}>Could not render formatted text in this block.</p>
        <p className={markdownFallbackHintClass}>Showing plain text instead.</p>
        <pre className={markdownFallbackPreClass}>{markdownSource}</pre>
      </div>
    ),
    [markdownSource],
  );
  const body = (
    <MarkdownMathErrorBoundary key={markdownSource} fallback={markdownErrorFallback}>
      <ReactMarkdown
        remarkPlugins={readerMarkdownRemarkPlugins}
        rehypePlugins={readerMarkdownRehypePlugins}
        components={mergedComponents}
      >
        {markdownSource}
      </ReactMarkdown>
    </MarkdownMathErrorBoundary>
  );
  if (className) {
    return <div className={className}>{body}</div>;
  }
  return body;
}
