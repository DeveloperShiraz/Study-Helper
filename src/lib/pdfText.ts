import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { MAX_PDF_IMPORT_BYTES } from './pdfImport';

let workerSrcAssigned = false;

function itemToString(item: unknown): string {
  if (item && typeof item === 'object' && 'str' in item) {
    const s = (item as { str: unknown }).str;
    return typeof s === 'string' ? s : '';
  }
  return '';
}

export interface ExtractPdfResult {
  text: string;
  pageCount: number;
}

/** `pageTexts[i]` is plain text for PDF page `i + 1` (1-based page number). */
export async function extractPdfPageTexts(file: File): Promise<{ pageTexts: string[]; pageCount: number }> {
  if (file.size > MAX_PDF_IMPORT_BYTES) {
    throw new Error(`PDF is too large (max ${Math.round(MAX_PDF_IMPORT_BYTES / (1024 * 1024))} MB).`);
  }

  const pdfjs = await import('pdfjs-dist');
  if (!workerSrcAssigned) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    workerSrcAssigned = true;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const line = textContent.items.map(itemToString).filter(Boolean).join(' ');
    pageTexts.push(line.trim());
  }

  return { pageTexts, pageCount: pdf.numPages };
}

export async function extractTextFromPdfFile(file: File): Promise<ExtractPdfResult> {
  const { pageTexts, pageCount } = await extractPdfPageTexts(file);
  const text = pageTexts.filter(Boolean).join('\n\n').trim();
  return { text, pageCount };
}
