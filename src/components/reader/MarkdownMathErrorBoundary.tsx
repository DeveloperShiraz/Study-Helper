import { Component, type ErrorInfo, type ReactNode } from 'react';

interface MarkdownMathErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface MarkdownMathErrorBoundaryState {
  hasError: boolean;
}

export class MarkdownMathErrorBoundary extends Component<
  MarkdownMathErrorBoundaryProps,
  MarkdownMathErrorBoundaryState
> {
  override state: MarkdownMathErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MarkdownMathErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MarkdownWithMath]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
