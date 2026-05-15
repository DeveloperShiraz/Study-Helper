import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Supabase URL + anon key must be present when `vite build` runs (they are baked into the SPA).
 * Cloudflare "Variables and secrets" on a Worker are often runtime-only and are NOT visible here.
 * Set the same values as build-time variables (Pages: Environment variables for the build;
 * CI: secrets available to the build job). Alternate names are accepted for hosts that reserve VITE_*.
 */
function resolveSupabaseUrl(mode: string): string {
  const fromFile = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL ?? '';
  return (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? fromFile).trim();
}

function resolveSupabaseAnonKey(mode: string): string {
  const fromFile = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_ANON_KEY ?? '';
  return (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? fromFile).trim();
}

export default defineConfig(({ mode }) => {
  const supabaseUrl = resolveSupabaseUrl(mode);
  const supabaseAnonKey = resolveSupabaseAnonKey(mode);

  return {
    plugins: [react(), cloudflare()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  };
});