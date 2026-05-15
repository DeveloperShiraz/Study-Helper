import type { ReactNode } from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';

interface SupabaseConfigGateProps {
  children: ReactNode;
}

const panelClass =
  'flex min-h-screen flex-col items-center justify-center bg-amber-50 px-6 py-12 text-center dark:bg-amber-950/40';

const bodyClass = 'mt-3 max-w-lg text-sm text-gray-700 dark:text-gray-300';

const codeClass = 'rounded bg-white px-1 py-0.5 text-xs dark:bg-gray-900';

export function SupabaseConfigGate({ children }: SupabaseConfigGateProps) {
  if (isSupabaseConfigured) {
    return <>{children}</>;
  }

  return (
    <div className={panelClass}>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Supabase is not configured</h1>
      <p className={bodyClass}>
        This app reads Supabase settings when the production bundle is built (Vite embeds them as{' '}
        <code className={codeClass}>import.meta.env</code>). A local <code className={codeClass}>.env</code> is the
        usual approach; copy <code className={codeClass}>.env.example</code> and set{' '}
        <code className={codeClass}>VITE_SUPABASE_URL</code> and <code className={codeClass}>VITE_SUPABASE_ANON_KEY</code>{' '}
        from Supabase <span className="font-medium">Project Settings → API</span>, then restart{' '}
        <code className={codeClass}>npm run dev</code>.
      </p>
      <p className={`${bodyClass} mt-4`}>
        <span className="font-medium text-gray-900 dark:text-gray-100">Cloudflare:</span> Worker-only &quot;Variables
        and secrets&quot; are injected at <em>runtime</em> and are <strong>not</strong> available during{' '}
        <code className={codeClass}>npm run build</code>, so the built site still has no keys. Add the{' '}
        <strong>same</strong> variables to your <strong>build</strong> environment (Cloudflare Pages → Settings →
        Environment variables for Production/Preview builds), or expose them to the CI job that runs the build. Names:{' '}
        <code className={codeClass}>VITE_SUPABASE_URL</code> and <code className={codeClass}>VITE_SUPABASE_ANON_KEY</code>
        . Alternatively, the build accepts <code className={codeClass}>SUPABASE_URL</code> and{' '}
        <code className={codeClass}>SUPABASE_ANON_KEY</code> as aliases.
      </p>
    </div>
  );
}
