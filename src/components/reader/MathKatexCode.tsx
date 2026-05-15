import katex from 'katex';
import { createElement, type ComponentPropsWithoutRef, type ReactElement } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import type { Element as HastElement } from 'hast';

export type MathKatexCodeProps = Readonly<
  ComponentPropsWithoutRef<'code'> &
    ExtraProps & {
      userCodeComponent?: Components['code'];
    }
>;

function flattenClassNames(className: MathKatexCodeProps['className']): string[] {
  if (Array.isArray(className)) {
    return className
      .flatMap((part) => (typeof part === 'string' ? part.split(/\s+/) : []))
      .filter(Boolean);
  }
  if (typeof className === 'string') {
    return className.split(/\s+/).filter(Boolean);
  }
  return [];
}

function classNameStringForDom(className: MathKatexCodeProps['className']): string | undefined {
  const parts = flattenClassNames(className);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function latexFromHastNode(node: HastElement | undefined): string {
  if (!node?.children?.length) {
    return '';
  }
  let out = '';
  for (const child of node.children) {
    if (child.type === 'text') {
      out += child.value;
    } else if (child.type === 'element') {
      out += latexFromHastNode(child);
    }
  }
  return out;
}

function isMathHastCode(node: HastElement | undefined, classNames: ReadonlySet<string>): boolean {
  if (!node || node.tagName !== 'code') {
    return false;
  }
  return (
    classNames.has('language-math') ||
    classNames.has('math-inline') ||
    classNames.has('math-display')
  );
}

function renderDefaultCode(props: Omit<MathKatexCodeProps, 'userCodeComponent'>): ReactElement {
  const { node: _node, children, className, ...domProps } = props;
  const safeClassName = classNameStringForDom(className);
  return createElement('code', { ...domProps, className: safeClassName }, children);
}

/**
 * Renders remark-math `code` nodes (language-math / math-inline / math-display) with KaTeX.
 * Avoids `rehype-katex`, which walks the HAST with `unist-util-visit-parents` and can throw when
 * a `children` array contains holes (`undefined`).
 */
export function MathKatexCode(props: MathKatexCodeProps): ReactElement {
  const { node, userCodeComponent, children, className, ...rest } = props;
  const names = new Set(flattenClassNames(className));

  if (!isMathHastCode(node, names)) {
    if (typeof userCodeComponent === 'function') {
      return createElement(userCodeComponent, props);
    }
    if (typeof userCodeComponent === 'string') {
      return createElement(userCodeComponent, props);
    }
    return renderDefaultCode({ node, children, className, ...rest });
  }

  const raw = latexFromHastNode(node).trim() || String(children ?? '').trim();
  if (!raw) {
    return renderDefaultCode({ node, children, className, ...rest });
  }

  const displayMode = names.has('math-display');
  const html = katex.renderToString(raw, {
    displayMode,
    throwOnError: false,
    strict: 'ignore',
  });

  const spanClassName = displayMode ? 'katex-display' : undefined;
  return createElement('span', {
    className: spanClassName,
    dangerouslySetInnerHTML: { __html: html },
  });
}
