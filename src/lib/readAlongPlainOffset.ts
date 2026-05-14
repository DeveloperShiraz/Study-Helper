/** Collapse whitespace for fuzzy match between DOM selection and speakable plain text. */
export function normalizeForReadAlongMatch(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Map browser selection text to a start index in the paragraph's speakable plain string.
 */
export function computePlainOffsetFromSelection(plain: string, selectedText: string): number {
  const trimmed = selectedText.trim();
  if (!trimmed) {
    return 0;
  }

  const direct = plain.indexOf(trimmed);
  if (direct >= 0) {
    return direct;
  }

  const needle = normalizeForReadAlongMatch(trimmed);
  const hay = normalizeForReadAlongMatch(plain);
  const j = hay.indexOf(needle);
  if (j >= 0) {
    const prefix = needle.slice(0, Math.min(32, needle.length));
    const k = plain.indexOf(prefix);
    if (k >= 0) {
      return k;
    }
  }

  const firstWord = needle.split(' ').find((w) => w.length >= 4);
  if (firstWord) {
    const k = plain.indexOf(firstWord);
    if (k >= 0) {
      return k;
    }
  }

  return 0;
}
