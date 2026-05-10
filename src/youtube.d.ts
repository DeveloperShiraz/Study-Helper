export {};

declare global {
  namespace YT {
    class Player {
      constructor(elementId: string, options: Record<string, unknown>);
      loadPlaylist(playlist: string | { list: string; listType: string }): void;
      loadVideoById(videoId: string): void;
      playVideo(): void;
      pauseVideo(): void;
      nextVideo(): void;
      previousVideo(): void;
      setVolume(volume: number): void;
      destroy(): void;
    }
  }

  interface Window {
    YT?: { Player: typeof YT.Player };
    onYouTubeIframeAPIReady?: () => void;
  }
}
