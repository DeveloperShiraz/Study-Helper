import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mapUserSettings, type UserSettingsRow } from '../../lib/dbMappers';
import { parseYoutubeUrl } from '../../lib/youtubeIds';
import { useApp } from '../../context/AppContext';
import { useMusicPlayer } from '../../hooks/useMusicPlayer';

const PLAYER_ELEMENT_ID = 'study-helper-yt-player';

export function MusicPlayerBar() {
  const { state, dispatch } = useApp();
  const { uiState, loadYoutubeMedia, togglePlay, nextTrack, prevTrack, setVolume, hideBar } = useMusicPlayer(
    PLAYER_ELEMENT_ID,
  );
  const [urlInput, setUrlInput] = useState('');
  const [isUrlOpen, setIsUrlOpen] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    const youtubeUrl = state.settings?.youtubeUrl;
    if (!youtubeUrl) return;
    const media = parseYoutubeUrl(youtubeUrl);
    if (media) {
      loadYoutubeMedia(media);
    }
  }, [state.settings?.youtubeUrl, loadYoutubeMedia]);

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
    'fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur';

  const showMiniActivator = !uiState.isBarVisible && !isUrlOpen;

  const isPlaylist = uiState.media?.kind === 'playlist';

  return (
    <>
      <div id={PLAYER_ELEMENT_ID} className="pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0" />

      {showMiniActivator && (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-30 rounded-full bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-800"
          onClick={() => setIsUrlOpen(true)}
        >
          Music
        </button>
      )}

      {isUrlOpen && (
        <div className="fixed bottom-16 right-4 z-40 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
          <p className="text-sm font-medium text-gray-900">YouTube URL</p>
          <p className="mt-1 text-xs text-gray-600">Playlist (list=…) or single video (watch?v=…).</p>
          <input
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.youtube.com/..."
          />
          {urlError && <p className="mt-2 text-xs text-red-600">{urlError}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
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
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-gray-900">Music</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                onClick={prevTrack}
                disabled={!isPlaylist}
                title={isPlaylist ? 'Previous track' : 'Playlist mode only'}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                onClick={togglePlay}
              >
                {uiState.isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
                onClick={nextTrack}
                disabled={!isPlaylist}
                title={isPlaylist ? 'Next track' : 'Playlist mode only'}
              >
                Next
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
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
              className="ml-auto rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              onClick={hideBar}
            >
              Hide bar
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
              onClick={() => setIsUrlOpen(true)}
            >
              Change URL
            </button>
          </div>
        </div>
      )}
    </>
  );
}
