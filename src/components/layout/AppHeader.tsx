import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from './ThemeToggle';

const TITLE = 'Study Helper';

export default function AppHeader() {
  const { dispatch } = useApp();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const openSettings = () => {
    dispatch({ type: 'SET_SETTINGS_PANEL', payload: true });
  };

  return (
    <header
      data-app-chrome
      className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
      style={{ padding: '12px 24px' }}
    >
      <a
        href="/home"
        className="flex items-center rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ gap: '8px' }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
          className="shrink-0 text-indigo-600 dark:text-indigo-400"
          style={{ width: '24px', height: '24px' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <span className="font-bold text-gray-900 dark:text-gray-100" style={{ fontSize: '18px' }}>
          {TITLE}
        </span>
      </a>

      <div className="flex items-center" style={{ gap: '8px' }}>
        <ThemeToggle style={{ fontSize: '14px', padding: '6px 12px' }} />
        <button
          type="button"
          onClick={openSettings}
          aria-label="Settings"
          className="flex items-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          style={{ gap: '6px', padding: '6px 10px', fontSize: '14px' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
            style={{ width: '16px', height: '16px', flexShrink: 0 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Settings</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-gray-200 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          style={{ padding: '6px 12px', fontSize: '14px' }}
        >
          Log out
        </button>
      </div>
    </header>
  );
}
