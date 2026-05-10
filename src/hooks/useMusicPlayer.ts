import { useCallback, useEffect, useRef, useState } from 'react';
import type { YoutubeMedia } from '../lib/youtubeIds';

const YT_SCRIPT_SRC = 'https://www.youtube.com/iframe_api';

export interface MusicPlayerUiState {
  isPlaying: boolean;
  volume: number;
  isBarVisible: boolean;
  media: YoutubeMedia | null;
}

function applyMedia(player: YT.Player, media: YoutubeMedia) {
  if (media.kind === 'playlist') {
    player.loadPlaylist({ list: media.id, listType: 'playlist' });
    return;
  }
  player.loadVideoById(media.id);
}

export function useMusicPlayer(playerElementId: string) {
  const playerRef = useRef<YT.Player | null>(null);
  const pendingMediaRef = useRef<YoutubeMedia | null>(null);
  const volumeRef = useRef(0.5);
  const [uiState, setUiState] = useState<MusicPlayerUiState>({
    isPlaying: false,
    volume: 0.5,
    isBarVisible: false,
    media: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const initPlayer = () => {
      if (isCancelled || playerRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(playerElementId, {
        height: '0',
        width: '0',
        playerVars: { controls: 0 },
        events: {
          onReady: (event: { target: YT.Player }) => {
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
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [playerElementId]);

  const loadYoutubeMedia = useCallback((media: YoutubeMedia) => {
    pendingMediaRef.current = media;
    setUiState((prev) => ({ ...prev, media, isBarVisible: true }));

    if (playerRef.current) {
      applyMedia(playerRef.current, media);
      pendingMediaRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    setUiState((prev) => {
      const nextIsPlaying = !prev.isPlaying;
      if (nextIsPlaying) {
        playerRef.current?.playVideo();
      } else {
        playerRef.current?.pauseVideo();
      }
      return { ...prev, isPlaying: nextIsPlaying };
    });
  }, []);

  const nextTrack = useCallback(() => {
    playerRef.current?.nextVideo();
  }, []);

  const prevTrack = useCallback(() => {
    playerRef.current?.previousVideo();
  }, []);

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = volume;
    setUiState((prev) => ({ ...prev, volume }));
    playerRef.current?.setVolume(volume * 100);
  }, []);

  const hideBar = useCallback(() => {
    setUiState((prev) => ({ ...prev, isBarVisible: false }));
  }, []);

  return { uiState, loadYoutubeMedia, togglePlay, nextTrack, prevTrack, setVolume, hideBar };
}
