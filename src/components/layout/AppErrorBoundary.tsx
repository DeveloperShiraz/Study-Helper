import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
          <p className="mt-3 max-w-lg whitespace-pre-wrap text-center text-sm text-gray-600 dark:text-gray-400">
            {this.state.message}
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
