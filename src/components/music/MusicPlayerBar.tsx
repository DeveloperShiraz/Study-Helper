import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mapUserSettings, type UserSettingsRow } from '../../lib/dbMappers';
import { parseYoutubeUrl } from '../../lib/youtubeIds';
import { useApp } from '../../context/AppContext';
import { useMusicPlayer } from '../../hooks/useMusicPlayer';

const PLAYBACK_SKIP_SEC = 10;
const SCRUBBER_STEP_SEC = 0.25;

function formatPlaybackClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const whole = Math.floor(totalSeconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function MusicPlayerBar() {
  const { state, dispatch } = useApp();
  const {
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
  } = useMusicPlayer();
  const [urlInput, setUrlInput] = useState('');
  const [isUrlOpen, setIsUrlOpen] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);
  const isScrubbingRef = useRef(false);
  const scrubberInputRef = useRef<HTMLInputElement>(null);

  async function persistYoutubeUrl(url: string) {
    if (!state.user) return { ok: false as const, message: 'Not signed in.' };

    const { data, error } = await supabase
      .from('user_settings')
      .update({ youtube_url: url, updated_at: new Date().toISOString() })
      .eq('user_id', state.user.id)
      .select('*')
      .maybeSingle();

    if (error) {
      return { ok: false as const, message: error.message };
    }

    if (!data) {
      return {
        ok: false as const,
        message: 'No saved settings row yet. Open Settings, save your AI configuration, then try again.',
      };
    }

    dispatch({ type: 'SET_SETTINGS', payload: mapUserSettings(data as UserSettingsRow) });
    return { ok: true as const };
  }

  async function handleSaveUrl() {
    setUrlError(null);
    const media = parseYoutubeUrl(urlInput);
    if (!media) {
      setUrlError('Paste a valid YouTube playlist URL (with list=) or a watch URL (with v=).');
      return;
    }

    const result = await persistYoutubeUrl(urlInput.trim());
    if (!result.ok) {
      setUrlError(result.message);
      return;
    }

    loadYoutubeMedia(media);
    setIsUrlOpen(false);
    setUrlInput('');
  }

  const barClass =
    'fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-900/95';

  const showMiniActivator = !uiState.isBarVisible && !isUrlOpen;

  const isPlaylist = uiState.media?.kind === 'playlist';
  const hasLoadedMedia = Boolean(uiState.media);
  const canSeekInTrack = playbackProgress.durationSec > 0.5;
  const scrubberMaxSec = Math.max(playbackProgress.durationSec, 0.01);
  const scrubberDisplaySec = scrubPreviewSec ?? playbackProgress.currentTimeSec;
  const scrubberAriaLabel = 'Seek position in current track';
  const seekSkipButtonClass =
    'rounded-md border border-gray-300 px-2 py-1 text-xs tabular-nums hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800';
  const scrubberInputClass =
    'h-1.5 min-w-0 flex-1 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-40';

  function handleScrubPointerDown() {
    isScrubbingRef.current = true;
  }

  function handleScrubChange() {
    if (!isScrubbingRef.current) return;
    const el = scrubberInputRef.current;
    if (!el) return;
    setScrubPreviewSec(Number(el.value));
  }

  function handleScrubPointerUp() {
    const wasScrubbing = isScrubbingRef.current;
    isScrubbingRef.current = false;
    const el = scrubberInputRef.current;
    setScrubPreviewSec(null);
    if (!el || !canSeekInTrack || !wasScrubbing) return;
    seekToTime(Number(el.value));
  }

  function handleMusicFabClick() {
    const saved = state.settings?.youtubeUrl?.trim() ?? '';
    const parsed = saved ? parseYoutubeUrl(saved) : null;
    if (parsed) {
      loadYoutubeMedia(parsed);
      return;
    }
    if (uiState.media) {
      showBar();
      return;
    }
    setIsUrlOpen(true);
  }

  return (
    <>
      {showMiniActivator && (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-50 flex flex-col items-center rounded-full bg-gray-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          onClick={handleMusicFabClick}
        >
          <span>Music</span>
          <span className="mt-0.5 text-[10px] font-normal opacity-80">Show controls</span>
        </button>
      )}

      {isUrlOpen && (
        <div className="fixed bottom-16 right-4 z-40 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">YouTube URL</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Playlist (list=…) or single video (watch?v=…).</p>
          <input
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/..."
          />
          {urlError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{urlError}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => {
                setIsUrlOpen(false);
                setUrlError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              onClick={handleSaveUrl}
            >
              Save & Play
            </button>
          </div>
        </div>
      )}

      {uiState.isBarVisible && (
        <div className={barClass}>
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Music</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
                  onClick={prevTrack}
                  disabled={!isPlaylist}
                  title={isPlaylist ? 'Previous track' : 'Playlist mode only'}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  onClick={togglePlay}
                >
                  {uiState.isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
                  onClick={nextTrack}
                  disabled={!isPlaylist}
                  title={isPlaylist ? 'Next track' : 'Playlist mode only'}
                >
                  Next
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                Vol
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={uiState.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className="ml-auto rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                onClick={hideBar}
              >
                Hide bar
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                onClick={() => setIsUrlOpen(true)}
              >
                Change URL
              </button>
            </div>

            {hasLoadedMedia && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400">Track</span>
                <button
                  type="button"
                  className={seekSkipButtonClass}
                  disabled={!canSeekInTrack}
                  title={canSeekInTrack ? `Back ${PLAYBACK_SKIP_SEC} seconds` : 'Position available after track loads'}
                  onClick={() => skipBySeconds(-PLAYBACK_SKIP_SEC)}
                >
                  −{PLAYBACK_SKIP_SEC}s
                </button>
                <input
                  ref={scrubberInputRef}
                  type="range"
                  className={scrubberInputClass}
                  min={0}
                  max={scrubberMaxSec}
                  step={SCRUBBER_STEP_SEC}
                  value={Math.min(scrubberDisplaySec, scrubberMaxSec)}
                  disabled={!canSeekInTrack}
                  aria-label={scrubberAriaLabel}
                  onPointerDown={handleScrubPointerDown}
                  onPointerUp={handleScrubPointerUp}
                  onPointerCancel={handleScrubPointerUp}
                  onChange={handleScrubChange}
                />
                <button
                  type="button"
                  className={seekSkipButtonClass}
                  disabled={!canSeekInTrack}
                  title={canSeekInTrack ? `Ahead ${PLAYBACK_SKIP_SEC} seconds` : 'Position available after track loads'}
                  onClick={() => skipBySeconds(PLAYBACK_SKIP_SEC)}
                >
                  +{PLAYBACK_SKIP_SEC}s
                </button>
                <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">
                  {formatPlaybackClock(scrubberDisplaySec)}
                  {canSeekInTrack ? ` / ${formatPlaybackClock(playbackProgress.durationSec)}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
