/**
 * PostgREST returns this when `user_settings.theme` is missing from the DB
 * or the API schema cache has not reloaded after adding the column.
 *
 * Apply the idempotent migration (same project as VITE_SUPABASE_URL):
 * @see ../../supabase/migrations/004_ensure_user_settings_theme.sql
 *
 * Or run the same SQL in the Supabase SQL Editor, including `notify pgrst, 'reload schema';`.
 */
export function isThemeColumnUnavailableError(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  const m = message.toLowerCase();
  if (!m.includes('theme')) return false;
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('column') ||
    m.includes('could not find')
  );
}

/**
 * Same class of PostgREST error when `tts_engine` / `tts_voice_uri` are missing or the schema cache is stale.
 *
 * Run in Supabase SQL Editor (same project as VITE_SUPABASE_URL), then reload schema:
 * @see ../../supabase/migrations/003_user_settings_tts.sql
 */
export function isTtsColumnUnavailableError(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  const m = message.toLowerCase();
  if (!m.includes('tts_')) return false;
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('column') ||
    m.includes('could not find')
  );
}

/**
 * PostgREST when `user_settings.reader_font_px` is missing or schema cache is stale.
 * @see ../../supabase/migrations/005_user_settings_reader_font.sql
 */
export function isReaderFontColumnUnavailableError(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  const m = message.toLowerCase();
  if (!m.includes('reader_font')) return false;
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('column') ||
    m.includes('could not find')
  );
}

/**
 * PostgREST when `task_ai_overrides` / Bedrock IAM columns are missing or schema cache is stale.
 * @see ../../supabase/migrations/006_user_settings_task_ai_bedrock.sql
 */
export function isTaskAiBedrockColumnUnavailableError(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  const m = message.toLowerCase();
  const hints = ['task_ai_overrides', 'bedrock_access_key', 'bedrock_region'];
  if (!hints.some((h) => m.includes(h))) return false;
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('column') ||
    m.includes('could not find')
  );
}
