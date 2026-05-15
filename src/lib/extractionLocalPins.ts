import type { Extraction } from '../types';

const STORAGE_KEY_PREFIX = 'study-helper-extraction-pins-v1';

function storageKey(userId: string, bookId: string, extractionType: Extraction['type']): string {
  return `${STORAGE_KEY_PREFIX}:${userId}:${bookId}:${extractionType}`;
}

export function readExtractionPinsJson(
  userId: string,
  bookId: string,
  extractionType: Extraction['type'],
): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(storageKey(userId, bookId, extractionType));
  } catch {
    return null;
  }
}

export function parseExtractionPins(raw: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeExtractionPins(
  userId: string,
  bookId: string,
  extractionType: Extraction['type'],
  pins: Record<string, string>,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(userId, bookId, extractionType), JSON.stringify(pins));
  } catch {
    /* ignore quota / private mode */
  }
}
