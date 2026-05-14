/** Raw PDF size limit before base64 (~33% overhead) and JSON body stay under typical API caps. */
export const MAX_PDF_IMPORT_BYTES = 20 * 1024 * 1024;

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}
