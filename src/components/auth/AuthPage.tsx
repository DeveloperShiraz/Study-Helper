import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from '../layout/ThemeToggle';

const PAGE_TITLE = 'Study Helper';
const SUBMIT_BUTTON_LABELS = {
  login: 'Log In',
  signup: 'Sign Up',
} as const;
const TOGGLE_TEXT = {
  login: "Don't have an account? Sign Up",
  signup: 'Already have an account? Log In',
} as const;

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { dispatch } = useApp();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session?.user) {
          dispatch({ type: 'SET_USER', payload: data.session.user });
          navigate('/home');
          return;
        }

        if (data.user && !data.session) {
          setError('Account created. Confirm your email from the link Supabase sent you, then sign in.');
          return;
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (data.user) {
          dispatch({ type: 'SET_USER', payload: data.user });
          navigate('/home');
        }
      }
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Authentication failed';
      if (message.toLowerCase().includes('email not confirmed')) {
        message =
          'Email not confirmed yet. Check your inbox or disable “Confirm email” in Supabase → Authentication → Providers → Email (for local dev only).';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const mode = isSignUp ? 'signup' : 'login';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-3xl font-bold text-gray-900 dark:text-gray-100">{PAGE_TITLE}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="sr-only">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="sr-only">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : SUBMIT_BUTTON_LABELS[mode]}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSignUp((prev) => !prev);
            setError(null);
          }}
          className="block w-full text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {TOGGLE_TEXT[mode]}
        </button>
      </div>
    </div>
  );
}
