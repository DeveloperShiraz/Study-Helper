const STORAGE_KEY = 'study-helper-music-session';
const SNAPSHOT_VERSION = 1 as const;

export interface MusicSessionSnapshot {
  version: typeof SNAPSHOT_VERSION;
  mediaKey: string;
  currentTimeSec: number;
  wasPlaying: boolean;
  volume: number;
  isBarVisible: boolean;
  savedAt: number;
}

export function readMusicSessionSnapshot(): MusicSessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (o.version !== SNAPSHOT_VERSION || typeof o.mediaKey !== 'string') return null;
    if (typeof o.currentTimeSec !== 'number' || !Number.isFinite(o.currentTimeSec)) return null;
    if (typeof o.wasPlaying !== 'boolean') return null;
    if (typeof o.volume !== 'number' || !Number.isFinite(o.volume)) return null;
    if (typeof o.isBarVisible !== 'boolean') return null;
    if (typeof o.savedAt !== 'number') return null;
    return {
      version: SNAPSHOT_VERSION,
      mediaKey: o.mediaKey,
      currentTimeSec: o.currentTimeSec,
      wasPlaying: o.wasPlaying,
      volume: o.volume,
      isBarVisible: o.isBarVisible,
      savedAt: o.savedAt,
    };
  } catch {
    return null;
  }
}

export function writeMusicSessionSnapshot(snapshot: MusicSessionSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}
