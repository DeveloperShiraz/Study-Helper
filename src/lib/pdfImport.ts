/** Raw PDF size limit before base64 (~33% overhead) and JSON body stay under typical API caps. */
export const MAX_PDF_IMPORT_BYTES = 20 * 1024 * 1024;

/**
 * Pause between multi-chapter PDF import segments for Gemini only, to reduce 429 / quota bursts.
 * (Other providers are called less aggressively by Google’s limits in practice.)
 */
export const PDF_IMPORT_MS_BETWEEN_GEMINI_SEGMENTS = 4500;

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}
