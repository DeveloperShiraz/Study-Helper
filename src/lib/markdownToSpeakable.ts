/** Strip common Markdown so Web Speech reads natural sentences (not markup). */
export function markdownToSpeakableText(markdown: string): string {
  let t = markdown.replace(/\r\n/g, '\n');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/!\[[^\]]*]\([^)]+\)/g, ' ');
  t = t.replace(/\[([^\]]*)]\([^)]+\)/g, '$1');
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/\*([^*\n]+)\*/g, '$1');
  t = t.replace(/^\s*[-*]\s+/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/[ \t]+/g, ' ');
  return t.trim();
}
