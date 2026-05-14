import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { mapUserSettings, type UserSettingsRow } from '../lib/dbMappers';
import { readStoredTheme, THEME_STORAGE_KEY } from '../lib/theme';
import type { UserSettings, MasterTopic, Book, Chapter, ThemePreference } from '../types';

interface AppState {
  user: User | null;
  isAuthReady: boolean;
  settings: UserSettings | null;
  isSettingsPanelOpen: boolean;
  isFirstLaunch: boolean;
  currentTopic: MasterTopic | null;
  currentBook: Book | null;
  currentChapter: Chapter | null;
  theme: ThemePreference;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTH_READY'; payload: boolean }
  | { type: 'SET_SETTINGS'; payload: UserSettings | null }
  | { type: 'SET_SETTINGS_PANEL'; payload: boolean }
  | { type: 'SET_FIRST_LAUNCH'; payload: boolean }
  | { type: 'SET_CURRENT_TOPIC'; payload: MasterTopic | null }
  | { type: 'SET_CURRENT_BOOK'; payload: Book | null }
  | { type: 'SET_CURRENT_CHAPTER'; payload: Chapter | null }
  | { type: 'SET_THEME'; payload: ThemePreference };

function getInitialState(): AppState {
  return {
    user: null,
    isAuthReady: false,
    settings: null,
    isSettingsPanelOpen: false,
    isFirstLaunch: false,
    currentTopic: null,
    currentBook: null,
    currentChapter: null,
    theme: readStoredTheme(),
  };
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTH_READY':
      return { ...state, isAuthReady: action.payload };
    case 'SET_SETTINGS':
      if (action.payload === null) {
        return { ...state, settings: null };
      }
      return {
        ...state,
        settings: action.payload,
        theme: action.payload.theme,
      };
    case 'SET_SETTINGS_PANEL':
      return { ...state, isSettingsPanelOpen: action.payload };
    case 'SET_FIRST_LAUNCH':
      return { ...state, isFirstLaunch: action.payload };
    case 'SET_CURRENT_TOPIC':
      return { ...state, currentTopic: action.payload };
    case 'SET_CURRENT_BOOK':
      return { ...state, currentBook: action.payload };
    case 'SET_CURRENT_CHAPTER':
      return { ...state, currentChapter: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, getInitialState);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      /* ignore quota / private mode */
    }
  }, [state.theme]);

  useLayoutEffect(() => {
    const px = state.settings?.readerFontPx ?? 18;
    document.documentElement.style.setProperty('--study-helper-reader-font', `${px}px`);
  }, [state.settings?.readerFontPx]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch({ type: 'SET_USER', payload: session?.user ?? null });
      if (!session) {
        dispatch({ type: 'SET_SETTINGS', payload: null });
        dispatch({ type: 'SET_SETTINGS_PANEL', payload: false });
        dispatch({ type: 'SET_FIRST_LAUNCH', payload: false });
        dispatch({ type: 'SET_CURRENT_TOPIC', payload: null });
        dispatch({ type: 'SET_CURRENT_BOOK', payload: null });
        dispatch({ type: 'SET_CURRENT_CHAPTER', payload: null });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch({ type: 'SET_USER', payload: session?.user ?? null });
      dispatch({ type: 'SET_AUTH_READY', payload: true });
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const user = state.user;
    if (!user) return;

    let cancelled = false;

    (async () => {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;

      if (data) {
        dispatch({ type: 'SET_SETTINGS', payload: mapUserSettings(data as UserSettingsRow) });
        dispatch({ type: 'SET_FIRST_LAUNCH', payload: false });
      } else {
        dispatch({ type: 'SET_SETTINGS', payload: null });
        dispatch({ type: 'SET_FIRST_LAUNCH', payload: true });
        dispatch({ type: 'SET_SETTINGS_PANEL', payload: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.user?.id]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
