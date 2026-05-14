export {};

declare global {
  namespace YT {
    class Player {
      constructor(host: string | HTMLElement, options: Record<string, unknown>);
      loadPlaylist(playlist: string | { list: string; listType: string }): void;
      loadVideoById(videoId: string): void;
      playVideo(): void;
      pauseVideo(): void;
      nextVideo(): void;
      previousVideo(): void;
      setVolume(volume: number): void;
      getCurrentTime(): number;
      getDuration(): number;
      seekTo(seconds: number, allowSeekAhead?: boolean): void;
      destroy(): void;
    }
  }

  interface Window {
    YT?: { Player: typeof YT.Player };
    onYouTubeIframeAPIReady?: () => void;
  }
}
