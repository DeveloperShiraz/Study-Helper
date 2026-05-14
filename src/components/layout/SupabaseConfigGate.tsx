import type { ReactNode } from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';

interface SupabaseConfigGateProps {
  children: ReactNode;
}

export function SupabaseConfigGate({ children }: SupabaseConfigGateProps) {
  if (isSupabaseConfigured) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-amber-50 px-6 py-12 text-center dark:bg-amber-950/40">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Supabase is not configured</h1>
      <p className="mt-3 max-w-md text-sm text-gray-700 dark:text-gray-300">
        Create a <code className="rounded bg-white px-1 py-0.5 text-xs dark:bg-gray-900">.env</code> file in the project
        root (you can start from{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs dark:bg-gray-900">.env.example</code>). Set{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs dark:bg-gray-900">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs dark:bg-gray-900">VITE_SUPABASE_ANON_KEY</code> to the
        values from
        Supabase <span className="font-medium">Project Settings → API</span> (Project URL and anon / publishable key).
        Save the file, then restart{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs dark:bg-gray-900">npm run dev</code>.
      </p>
    </div>
  );
}
