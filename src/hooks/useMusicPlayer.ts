import { useCallback, useEffect, useRef, useState } from 'react';
import type { YoutubeMedia } from '../lib/youtubeIds';
import {
  readMusicSessionSnapshot,
  writeMusicSessionSnapshot,
} from '../lib/musicSessionStorage';

const YT_SCRIPT_SRC = 'https://www.youtube.com/iframe_api';
const PLAYBACK_POLL_MS = 500;
const SESSION_PERSIST_MS = 1500;

export interface MusicPlayerUiState {
  isPlaying: boolean;
  volume: number;
  isBarVisible: boolean;
  media: YoutubeMedia | null;
}

export interface MusicPlaybackProgress {
  currentTimeSec: number;
  durationSec: number;
}

function applyMedia(player: YT.Player, media: YoutubeMedia) {
  if (media.kind === 'playlist') {
    player.loadPlaylist({ list: media.id, listType: 'playlist' });
    return;
  }
  player.loadVideoById(media.id);
}

function createOffscreenPlayerMount(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.className = 'pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0';
  document.body.appendChild(el);
  return el;
}

export function useMusicPlayer() {
  const playerRef = useRef<YT.Player | null>(null);
  const isPlayerReadyRef = useRef(false);
  const pendingMediaRef = useRef<YoutubeMedia | null>(null);
  const volumeRef = useRef(0.5);
  const uiStateRef = useRef<MusicPlayerUiState>({
    isPlaying: false,
    volume: 0.5,
    isBarVisible: false,
    media: null,
  });
  const mediaKeyRef = useRef<string | null>(null);
  const restoredMediaKeyRef = useRef<string | null>(null);
  const [uiState, setUiState] = useState<MusicPlayerUiState>({
    isPlaying: false,
    volume: 0.5,
    isBarVisible: false,
    media: null,
  });
  const [playbackProgress, setPlaybackProgress] = useState<MusicPlaybackProgress>({
    currentTimeSec: 0,
    durationSec: 0,
  });

  const mediaKey = uiState.media ? `${uiState.media.kind}:${uiState.media.id}` : null;

  uiStateRef.current = uiState;
  mediaKeyRef.current = mediaKey;

  useEffect(() => {
    restoredMediaKeyRef.current = null;
  }, [mediaKey]);

  useEffect(() => {
    if (!mediaKey || playbackProgress.durationSec < 0.5) return;
    const player = playerRef.current;
    if (!player || !isPlayerReadyRef.current) return;
    if (restoredMediaKeyRef.current === mediaKey) return;

    const snap = readMusicSessionSnapshot();
    if (!snap || snap.mediaKey !== mediaKey) {
      restoredMediaKeyRef.current = mediaKey;
      return;
    }

    restoredMediaKeyRef.current = mediaKey;
    const maxT = playbackProgress.durationSec;
    const t = Math.max(0, Math.min(snap.currentTimeSec, maxT > 1 ? maxT - 0.25 : 0));
    player.seekTo(t, true);
    volumeRef.current = snap.volume;
    player.setVolume(snap.volume * 100);
    setUiState((prev) => ({
      ...prev,
      volume: snap.volume,
      isBarVisible: snap.isBarVisible,
      isPlaying: false,
    }));
    player.pauseVideo();
  }, [mediaKey, playbackProgress.durationSec]);

  useEffect(() => {
    if (!mediaKey) return;
    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !isPlayerReadyRef.current) return;
      const key = mediaKeyRef.current;
      if (!key) return;
      const u = uiStateRef.current;
      let currentTimeSec = 0;
      try {
        currentTimeSec = player.getCurrentTime();
      } catch {
        return;
      }
      if (!Number.isFinite(currentTimeSec)) return;
      writeMusicSessionSnapshot({
        version: 1,
        mediaKey: key,
        currentTimeSec,
        wasPlaying: u.isPlaying,
        volume: u.volume,
        isBarVisible: u.isBarVisible,
        savedAt: Date.now(),
      });
    }, SESSION_PERSIST_MS);
    return () => window.clearInterval(intervalId);
  }, [mediaKey]);

  useEffect(() => {
    function flushSession() {
      const player = playerRef.current;
      if (!player || !isPlayerReadyRef.current) return;
      const key = mediaKeyRef.current;
      if (!key) return;
      const u = uiStateRef.current;
      let currentTimeSec = 0;
      try {
        currentTimeSec = player.getCurrentTime();
      } catch {
        return;
      }
      if (!Number.isFinite(currentTimeSec)) return;
      writeMusicSessionSnapshot({
        version: 1,
        mediaKey: key,
        currentTimeSec,
        wasPlaying: u.isPlaying,
        volume: u.volume,
        isBarVisible: u.isBarVisible,
        savedAt: Date.now(),
      });
    }
    window.addEventListener('beforeunload', flushSession);
    window.addEventListener('pagehide', flushSession);
    return () => {
      window.removeEventListener('beforeunload', flushSession);
      window.removeEventListener('pagehide', flushSession);
    };
  }, []);

  useEffect(() => {
    if (!mediaKey) {
      setPlaybackProgress({ currentTimeSec: 0, durationSec: 0 });
      return;
    }

    const tick = () => {
      const player = playerRef.current;
      if (!player || !isPlayerReadyRef.current) return;
      const durationRaw = player.getDuration();
      const currentRaw = player.getCurrentTime();
      const durationSec = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 0;
      const currentTimeSec =
        Number.isFinite(currentRaw) && currentRaw >= 0 ? currentRaw : 0;
      setPlaybackProgress({ currentTimeSec, durationSec });
    };

    tick();
    const intervalId = window.setInterval(tick, PLAYBACK_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [mediaKey]);

  useEffect(() => {
    let isCancelled = false;
    const mountEl = createOffscreenPlayerMount();

    const initPlayer = () => {
      if (isCancelled || playerRef.current || !window.YT?.Player) return;

      isPlayerReadyRef.current = false;
      playerRef.current = new window.YT.Player(mountEl, {
        height: '0',
        width: '0',
        playerVars: { controls: 0, autoplay: 0 },
        events: {
          onReady: (event: { target: YT.Player }) => {
            isPlayerReadyRef.current = true;
            event.target.setVolume(volumeRef.current * 100);
            const pending = pendingMediaRef.current;
            if (pending) {
              applyMedia(event.target, pending);
              pendingMediaRef.current = null;
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector(`script[src="${YT_SCRIPT_SRC}"]`)) {
        const tag = document.createElement('script');
        tag.src = YT_SCRIPT_SRC;
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript.parentNode?.insertBefore(tag, firstScript);
      }
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        initPlayer();
      };
    }

    return () => {
      isCancelled = true;
      isPlayerReadyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
      mountEl.remove();
    };
  }, []);

  const loadYoutubeMedia = useCallback((media: YoutubeMedia) => {
    pendingMediaRef.current = media;
    setUiState((prev) => ({ ...prev, media, isBarVisible: true }));

    if (playerRef.current && isPlayerReadyRef.current) {
      applyMedia(playerRef.current, media);
      pendingMediaRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    setUiState((prev) => {
      const nextIsPlaying = !prev.isPlaying;
      const snapshotBarVisible = prev.isBarVisible;
      const snapshotVolume = prev.volume;
      const player = playerRef.current;
      if (player && isPlayerReadyRef.current) {
        if (nextIsPlaying) {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      }
      queueMicrotask(() => {
        const p = playerRef.current;
        const key = mediaKeyRef.current;
        if (!p || !isPlayerReadyRef.current || !key) {
          return;
        }
        let currentTimeSec = 0;
        try {
          currentTimeSec = p.getCurrentTime();
        } catch {
          return;
        }
        if (!Number.isFinite(currentTimeSec)) {
          return;
        }
        writeMusicSessionSnapshot({
          version: 1,
          mediaKey: key,
          currentTimeSec,
          wasPlaying: nextIsPlaying,
          volume: snapshotVolume,
          isBarVisible: snapshotBarVisible,
          savedAt: Date.now(),
        });
      });
      return { ...prev, isPlaying: nextIsPlaying };
    });
  }, []);

  const nextTrack = useCallback(() => {
    const player = playerRef.current;
    if (player && isPlayerReadyRef.current) {
      player.nextVideo();
    }
  }, []);

  const prevTrack = useCallback(() => {
    const player = playerRef.current;
    if (player && isPlayerReadyRef.current) {
      player.previousVideo();
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = volume;
    setUiState((prev) => ({ ...prev, volume }));
    const player = playerRef.current;
    if (player && isPlayerReadyRef.current) {
      player.setVolume(volume * 100);
    }
  }, []);

  const seekToTime = useCallback((seconds: number) => {
    const player = playerRef.current;
    if (!player || !isPlayerReadyRef.current) return;
    const durationRaw = player.getDuration();
    const hasDuration = Number.isFinite(durationRaw) && durationRaw > 0;
    const clamped = hasDuration
      ? Math.max(0, Math.min(seconds, durationRaw))
      : Math.max(0, seconds);
    player.seekTo(clamped, true);
    setPlaybackProgress((prev) => ({
      ...prev,
      currentTimeSec: clamped,
      durationSec: hasDuration ? durationRaw : prev.durationSec,
    }));
  }, []);

  const skipBySeconds = useCallback(
    (deltaSec: number) => {
      const player = playerRef.current;
      if (!player || !isPlayerReadyRef.current) return;
      const current = player.getCurrentTime();
      if (!Number.isFinite(current)) return;
      seekToTime(current + deltaSec);
    },
    [seekToTime],
  );

  const hideBar = useCallback(() => {
    setUiState((prev) => ({ ...prev, isBarVisible: false }));
  }, []);

  const showBar = useCallback(() => {
    setUiState((prev) => ({ ...prev, isBarVisible: true }));
  }, []);

  return {
    uiState,
    playbackProgress,
    loadYoutubeMedia,
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    seekToTime,
    skipBySeconds,
    hideBar,
    showBar,
  };
}
