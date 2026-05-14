import { createClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const isPlaceholderUrl = rawUrl.includes('your-project') || rawUrl.length === 0;
const isPlaceholderKey = rawKey === 'your-anon-key' || rawKey.length === 0;

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;

export const supabase = createClient(
  isSupabaseConfigured ? rawUrl : PLACEHOLDER_URL,
  isSupabaseConfigured ? rawKey : PLACEHOLDER_KEY,
);
