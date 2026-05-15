import { createElement, type ComponentProps, type ReactElement } from 'react';
import type { Components } from 'react-markdown';
import { MathKatexCode } from './MathKatexCode';

type MathCodeProps = Readonly<ComponentProps<typeof MathKatexCode>>;

function createMathCodeRenderer(userCode: Components['code'] | undefined) {
  return function MarkdownMathCode(props: MathCodeProps): ReactElement {
    return createElement(MathKatexCode, { ...props, userCodeComponent: userCode });
  };
}

/**
 * Injects a `code` renderer that typesets remark-math nodes with KaTeX while delegating other
 * `code` elements to the prior `components.code` (if any).
 */
export function mergeMarkdownComponentsWithMath(components: Components | undefined): Components {
  if (!components) {
    return {
      code: createMathCodeRenderer(undefined),
    };
  }

  const { code: userCode, ...rest } = components;
  return {
    ...rest,
    code: createMathCodeRenderer(userCode),
  };
}
