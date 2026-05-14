/** Split stored chapter body into reader paragraphs (blank-line separated blocks). */
export function splitIntoParagraphs(raw: string): string[] {
  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
