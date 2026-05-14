/** Shown when auth routes mounted but `state.user` is not ready yet (avoids an empty main area). */
export function AuthenticatedSessionFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-400">
      Restoring session…
    </div>
  );
}
