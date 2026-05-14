const STORAGE_KEY = 'study-helper-read-along-skip-sec';

export const READ_ALONG_SKIP_INCREMENT_OPTIONS = [5, 10, 15] as const;

export type ReadAlongSkipIncrementSec = (typeof READ_ALONG_SKIP_INCREMENT_OPTIONS)[number];

function isSkipIncrement(v: number): v is ReadAlongSkipIncrementSec {
  return v === 5 || v === 10 || v === 15;
}

export function readStoredReadAlongSkipIncrement(): ReadAlongSkipIncrementSec {
  if (typeof window === 'undefined') {
    return 5;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw === null ? NaN : Number(raw);
  return isSkipIncrement(n) ? n : 5;
}

export function writeStoredReadAlongSkipIncrement(value: ReadAlongSkipIncrementSec): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, String(value));
}
