export function parseSimplifyAB(raw: string): { versionA: string; versionB: string } {
  const normalized = raw.replace(/\r/g, '').trim();
  const bSplit = normalized.split(/\nB[\s:]*\n/i);
  if (bSplit.length >= 2) {
    const versionA = bSplit[0].replace(/^A[\s:]*\n?/i, '').trim();
    const versionB = bSplit.slice(1).join('\nB:\n').trim();
    return { versionA, versionB };
  }

  const parts = normalized.split(/\n{2,}/);
  if (parts.length >= 2) {
    return { versionA: parts[0].trim(), versionB: parts.slice(1).join('\n\n').trim() };
  }

  return { versionA: normalized, versionB: '' };
}
