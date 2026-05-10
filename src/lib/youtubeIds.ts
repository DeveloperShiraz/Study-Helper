export type YoutubeMedia =
  | { kind: 'playlist'; id: string }
  | { kind: 'video'; id: string };

export function parseYoutubeUrl(url: string): YoutubeMedia | null {
  const trimmed = url.trim();

  const listMatch = trimmed.match(/[?&]list=([^&]+)/);
  if (listMatch) {
    return { kind: 'playlist', id: listMatch[1] };
  }

  const vMatch = trimmed.match(/[?&]v=([^&]+)/);
  if (vMatch) {
    return { kind: 'video', id: vMatch[1] };
  }

  const shortMatch = trimmed.match(/youtu\.be\/([^?&#]+)/);
  if (shortMatch) {
    return { kind: 'video', id: shortMatch[1] };
  }

  return null;
}

/** @deprecated Prefer parseYoutubeUrl for playlist + video support */
export function extractYoutubePlaylistId(url: string): string | null {
  const parsed = parseYoutubeUrl(url);
  return parsed?.kind === 'playlist' ? parsed.id : null;
}
