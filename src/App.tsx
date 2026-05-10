import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import AuthPage from './components/auth/AuthPage';
import { HomePage } from './components/home/HomePage';
import { MasterTopicPage } from './components/topic/MasterTopicPage';
import { ChapterReadingView } from './components/reader/ChapterReadingView';
import { SettingsPanel } from './components/layout/SettingsPanel';

function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useApp();
  if (!state.isAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">Loading…</div>
    );
  }
  if (!state.user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function RootRoute() {
  const { state } = useApp();
  if (!state.isAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">Loading…</div>
    );
  }
  if (state.user) {
    return <Navigate to="/home" replace />;
  }
  return <AuthPage />;
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { state } = useApp();
  return (
    <>
      {children}
      {state.user ? <SettingsPanel /> : null}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route
        path="/home"
        element={
          <AuthGate>
            <AuthenticatedShell>
              <HomePage />
            </AuthenticatedShell>
          </AuthGate>
        }
      />
      <Route
        path="/topic/:topicId"
        element={
          <AuthGate>
            <AuthenticatedShell>
              <MasterTopicPage />
            </AuthenticatedShell>
          </AuthGate>
        }
      />
      <Route
        path="/topic/:topicId/book/:bookId/chapter/:chapterId"
        element={
          <AuthGate>
            <AuthenticatedShell>
              <ChapterReadingView />
            </AuthenticatedShell>
          </AuthGate>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
