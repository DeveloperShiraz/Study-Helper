/**
 * Collapses a "### Term\nDefinition…" definition block into a single inline
 * "**Term** — Definition…" string for compact rendering.
 *
 * Returns the input unchanged if it does not look like a heading-then-paragraph block.
 */
export function formatDefinitionInline(text: string): string {
  const match = text.match(/^\s*#{1,6}\s+(.+?)\s*\n+([\s\S]+)$/);
  if (!match) return text;
  const term = match[1].trim();
  const definition = match[2].trim().replace(/\s*\n+\s*/g, ' ');
  if (!term || !definition) return text;
  return `**${term}** — ${definition}`;
}
