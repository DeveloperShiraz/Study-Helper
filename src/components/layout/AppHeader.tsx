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
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{TITLE}</h1>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={openSettings}
          aria-label="Settings"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Log Out
        </button>
      </div>
    </header>
  );
}
