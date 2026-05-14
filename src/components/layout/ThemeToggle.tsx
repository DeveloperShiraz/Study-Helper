import type React from 'react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mapUserSettings, type UserSettingsRow } from '../../lib/dbMappers';
import { isThemeColumnUnavailableError } from '../../lib/themePersist';
import { useApp } from '../../context/AppContext';

const BUTTON_CLASS =
  'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ThemeToggle({ className, style }: ThemeToggleProps) {
  const { state, dispatch } = useApp();
  const [isSaving, setIsSaving] = useState(false);

  const label = state.theme === 'dark' ? 'Light mode' : 'Dark mode';
  const combinedClass = className ? `${BUTTON_CLASS} ${className}` : BUTTON_CLASS;

  async function handleClick() {
    const previous = state.theme;
    const next = previous === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', payload: next });

    if (!state.user || !state.settings) {
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .update({ theme: next, updated_at: new Date().toISOString() })
        .eq('user_id', state.user.id)
        .select('*')
        .single();

      if (error) {
        if (isThemeColumnUnavailableError(error.message)) {
          // Theme still applies via html class + localStorage; DB sync skipped until migration runs.
          console.warn('[theme]', error.message);
          return;
        }
        window.alert(error.message);
        dispatch({ type: 'SET_THEME', payload: previous });
        return;
      }

      if (data) {
        dispatch({ type: 'SET_SETTINGS', payload: mapUserSettings(data as UserSettingsRow) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isThemeColumnUnavailableError(message)) {
        console.warn('[theme]', message);
        return;
      }
      window.alert(message);
      dispatch({ type: 'SET_THEME', payload: previous });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      className={combinedClass}
      style={style}
      onClick={() => void handleClick()}
      disabled={isSaving}
      aria-label={label}
    >
      {isSaving ? 'Saving…' : label}
    </button>
  );
}
