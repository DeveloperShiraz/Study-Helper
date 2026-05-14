import { createElement, type CSSProperties, type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import { READER_MARKDOWN_H2_OFFSET_PX } from '../../lib/dbMappers';

const readerH2FontSizeStyle: CSSProperties = {
  fontSize: `calc(var(--study-helper-reader-font, 16px) + ${String(READER_MARKDOWN_H2_OFFSET_PX)}px)`,
};

function buildHeadingRenderer(
  paragraphId: string,
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  className: string,
  counter: { value: number },
  headingStyle?: CSSProperties,
): NonNullable<Components['h1']> {
  return (props) => {
    const raw = props as {
      node?: unknown;
      children?: ReactNode;
      ref?: unknown;
    };
    const { node: _node, children, ref } = raw;
    const headingIndex = counter.value;
    const id = `${paragraphId}-h-${headingIndex}`;
    counter.value += 1;
    const domProps: Record<string, unknown> = {
      id,
      className,
      'data-heading-index': String(headingIndex),
    };
    if (headingStyle) {
      domProps.style = headingStyle;
    }
    if (ref !== undefined) {
      domProps.ref = ref;
    }
    return createElement(tag, domProps, children);
  };
}

export function createReaderMarkdownComponents(paragraphId: string): Components {
  const counter = { value: 0 };
  return {
    h1: buildHeadingRenderer(
      paragraphId,
      'h1',
      'mt-5 scroll-mt-24 font-bold tracking-tight text-gray-900 first:mt-0 dark:text-gray-50',
      counter,
      { fontSize: '1.6em' },
    ),
    h2: buildHeadingRenderer(
      paragraphId,
      'h2',
      'mt-5 scroll-mt-24 font-bold leading-snug tracking-tight text-gray-900 first:mt-0 dark:text-gray-50',
      counter,
      readerH2FontSizeStyle,
    ),
    h3: buildHeadingRenderer(
      paragraphId,
      'h3',
      'mt-4 scroll-mt-24 font-semibold text-gray-900 dark:text-gray-100',
      counter,
      { fontSize: '1.2em' },
    ),
    h4: buildHeadingRenderer(
      paragraphId,
      'h4',
      'mt-3 scroll-mt-24 font-semibold text-gray-900 dark:text-gray-100',
      counter,
      { fontSize: '1.05em' },
    ),
    h5: buildHeadingRenderer(
      paragraphId,
      'h5',
      'mt-3 scroll-mt-24 font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200',
      counter,
      { fontSize: '0.9em' },
    ),
    h6: buildHeadingRenderer(
      paragraphId,
      'h6',
      'mt-2 scroll-mt-24 font-semibold text-gray-800 dark:text-gray-200',
      counter,
      { fontSize: '0.875em' },
    ),
    ul: ({ node: _node, children, ...rest }) =>
      createElement('ul', { className: 'my-2 list-disc space-y-1 pl-6', ...rest }, children as ReactNode),
    ol: ({ node: _node, children, ...rest }) =>
      createElement('ol', { className: 'my-2 list-decimal space-y-1 pl-6', ...rest }, children as ReactNode),
    li: ({ node: _node, children, ...rest }) =>
      createElement('li', { className: 'leading-relaxed', ...rest }, children as ReactNode),
    strong: ({ node: _node, children, ...rest }) =>
      createElement(
        'strong',
        { className: 'font-semibold text-gray-900 dark:text-gray-50', ...rest },
        children as ReactNode,
      ),
    p: ({ node: _node, children, ...rest }) =>
      createElement('p', { className: 'whitespace-pre-wrap leading-relaxed', ...rest }, children as ReactNode),
  };
}
