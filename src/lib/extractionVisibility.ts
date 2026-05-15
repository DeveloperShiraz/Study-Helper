import type { Extraction, ExtractionItem } from '../types';

const EXTRACTION_NONE_FOUND_LINE = /^\s*none\s*found\.?\s*$/i;
const EXTRACTION_META_NOISE_LINE = /already\s*captured;\s*no\s*new\s*formula\s*here/i;

export function isVisibleExtractionText(text: string): boolean {
  const t = text.trim();
  if (!t) {
    return false;
  }
  if (EXTRACTION_NONE_FOUND_LINE.test(t)) {
    return false;
  }
  if (EXTRACTION_META_NOISE_LINE.test(t)) {
    return false;
  }
  return true;
}

export function getVisibleExtractionTexts(extraction: Extraction | undefined): string[] {
  if (!extraction?.content?.length) {
    return [];
  }
  return extraction.content.map((item) => item.text).filter(isVisibleExtractionText);
}

export function hasVisibleExtractionContent(extraction: Extraction | undefined): boolean {
  return getVisibleExtractionTexts(extraction).length > 0;
}

export function getVisibleExtractionItems(extraction: Extraction | undefined): ExtractionItem[] {
  if (!extraction?.content?.length) {
    return [];
  }
  return extraction.content.filter((item) => isVisibleExtractionText(item.text));
}
