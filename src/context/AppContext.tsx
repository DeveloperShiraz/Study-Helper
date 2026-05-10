import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserSettings, MasterTopic, Book, Chapter } from '../types';

interface AppState {
  user: User | null;
  isAuthReady: boolean;
  settings: UserSettings | null;
  isSettingsPanelOpen: boolean;
  isFirstLaunch: boolean;
  currentTopic: MasterTopic | null;
  currentBook: Book | null;
  currentChapter: Chapter | null;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTH_READY'; payload: boolean }
  | { type: 'SET_SETTINGS'; payload: UserSettings | null }
  | { type: 'SET_SETTINGS_PANEL'; payload: boolean }
  | { type: 'SET_FIRST_LAUNCH'; payload: boolean }
  | { type: 'SET_CURRENT_TOPIC'; payload: MasterTopic | null }
  | { type: 'SET_CURRENT_BOOK'; payload: Book | null }
  | { type: 'SET_CURRENT_CHAPTER'; payload: Chapter | null };

const initialState: AppState = {
  user: null,
  isAuthReady: false,
  settings: null,
  isSettingsPanelOpen: false,
  isFirstLaunch: false,
  currentTopic: null,
  currentBook: null,
  currentChapter: null,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTH_READY':
      return { ...state, isAuthReady: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
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
  const [state, dispatch] = useReducer(appReducer, initialState);

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

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
