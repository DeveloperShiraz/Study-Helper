import type { ThemePreference } from '../types';

export const THEME_STORAGE_KEY = 'study-helper-theme';

export function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'dark' ? 'dark' : 'light';
}

export function parseTheme(value: string | null | undefined): ThemePreference {
  return value === 'dark' ? 'dark' : 'light';
}
