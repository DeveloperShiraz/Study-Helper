import { useCallback, useEffect, useRef, useState } from 'react';
import type { Paragraph } from '../types';
import { pickDefaultSpeechVoice, resolveSpeechVoiceByUri } from '../lib/pickSpeechSynthesisVoice';
import { readAlongPlainForParagraph } from '../lib/readAlongParagraphPlain';
import { clearReadAlongCssHighlight } from '../lib/readAlongDomText';

/** Lower bound so highlight can keep up when pace estimate is cold. */
const READ_ALONG_MIN_PACE_CHARS_PER_MS = 0.012;
/** Forward bias — allows RAF loop to advance past the middle of a word between events. */
const READ_ALONG_PACE_BOOST = 1.15;
/** Wall-clock multiplier — kept at 1.0 since utterCharsPerSecRef now tracks cumulative rate accurately. */
const READ_ALONG_WALL_CLOCK_SEC_GAIN = 1.0;
const READ_ALONG_CHARS_PER_SEC_INITIAL = 16;

export { paragraphPlain, readAlongPlainForParagraph } from '../lib/readAlongParagraphPlain';

export interface ReadAlongHighlight {
  paragraphId: string;
  charStart: number;
  charEnd: number;
}

function resolveSkipInChapter(
  list: Paragraph[],
  startIdx: number,
  startPos: number,
  deltaChars: number,
): { idx: number; off: number } {
  let idx = startIdx;
  let pos = startPos + deltaChars;

  while (pos < 0 && idx > 0) {
    idx -= 1;
    pos += readAlongPlainForParagraph(list[idx]).length;
  }
  if (idx < 0 || pos < 0) {
    return { idx: 0, off: 0 };
  }

  const maxIdx = list.length - 1;
  while (idx <= maxIdx) {
    const len = readAlongPlainForParagraph(list[idx]).length;
    if (pos <= len) {
      return { idx, off: pos };
    }
    pos -= len;
    idx += 1;
  }

  const last = list[maxIdx];
  const lastLen = last ? readAlongPlainForParagraph(last).length : 0;
  return { idx: maxIdx, off: lastLen };
}

function wordSpanAtUtterOffset(text: string, offsetInUtter: number): { start: number; end: number } {
  const len = text.length;
  if (len === 0) {
    return { start: 0, end: 0 };
  }
  let o = Math.floor(Math.min(Math.max(0, offsetInUtter), len));
  if (o === len) {
    o = len - 1;
  }
  while (o < len && /\s/.test(text[o])) {
    o += 1;
  }
  if (o >= len) {
    let j = len - 1;
    while (j >= 0 && /\s/.test(text[j])) {
      j -= 1;
    }
    if (j < 0) {
      return { start: 0, end: 0 };
    }
    o = j;
  }
  let s = o;
  while (s > 0 && !/\s/.test(text[s - 1])) {
    s -= 1;
  }
  let e = o;
  while (e < len && !/\s/.test(text[e])) {
    e += 1;
  }
  return { start: s, end: e };
}

function activeWordSpanFromHeardExclusive(text: string, heardExclusive: number): { start: number; end: number } {
  const len = text.length;
  if (len === 0) {
    return { start: 0, end: 0 };
  }
  const h = Math.min(Math.max(0, heardExclusive), len);
  if (h <= 0) {
    return wordSpanAtUtterOffset(text, 0);
  }
  return wordSpanAtUtterOffset(text, h - 1);
}

export function useReadAlong(
  paragraphsSorted: Paragraph[],
  options?: { voiceUri?: string | null },
) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<ReadAlongHighlight | null>(null);

  const listRef = useRef(paragraphsSorted);
  const indexRef = useRef(0);
  const isRunningRef = useRef(false);
  const startParaIdxRef = useRef(0);
  const startPlainOffRef = useRef(0);
  const liveParagraphIdxRef = useRef(0);
  const liveCharEndRef = useRef(0);
  const paceCharsPerMsRef = useRef(0.012);
  /** Heard progress within the current utterance string (exclusive end index). */
  const readAlongSyncRef = useRef({ time: 0, heardExclusiveUtter: 0 });
  /** Last boundary-reported word end in utterance coords — pace estimation only. */
  const paceAnchorRef = useRef({ time: 0, charIndex: 0 });
  const utterHighlightRafRef = useRef<number | null>(null);
  const resumeHighlightDriverRef = useRef<(() => void) | null>(null);
  const lastHighlightKeyRef = useRef('');
  const isPausedRef = useRef(false);
  /** Current utter length for freezing heard progress on pause. */
  const activeUtterLenRef = useRef(0);
  const utterWallStartRef = useRef(0);
  const utterCharsPerSecRef = useRef(READ_ALONG_CHARS_PER_SEC_INITIAL);
  const voiceUriRef = useRef<string | null>(options?.voiceUri ?? null);
  /** When the user leaves Voice on "Default", lock onto one voiceURI for the whole session so it does not swap per paragraph. */
  const stickyDefaultVoiceUriRef = useRef<string | null>(null);

  useEffect(() => {
    voiceUriRef.current = options?.voiceUri?.trim() ? options.voiceUri.trim() : null;
  }, [options?.voiceUri]);

  function attachVoiceToUtterance(utterance: SpeechSynthesisUtterance) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    void window.speechSynthesis.getVoices();
    const preferred = voiceUriRef.current?.trim() || null;
    let v: SpeechSynthesisVoice | undefined;

    if (preferred) {
      v = resolveSpeechVoiceByUri(preferred);
    }
    if (!v && stickyDefaultVoiceUriRef.current) {
      v = resolveSpeechVoiceByUri(stickyDefaultVoiceUriRef.current);
    }
    if (!v) {
      const def = pickDefaultSpeechVoice();
      if (def) {
        stickyDefaultVoiceUriRef.current = def.voiceURI;
        v = def;
      }
    }
    if (v) {
      utterance.voice = v;
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      utterance.lang = navigator.language;
    }
  }

  useEffect(() => {
    listRef.current = paragraphsSorted;
  }, [paragraphsSorted]);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  function clearUtteranceHighlightDriver() {
    if (utterHighlightRafRef.current !== null) {
      cancelAnimationFrame(utterHighlightRafRef.current);
      utterHighlightRafRef.current = null;
    }
  }

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    clearUtteranceHighlightDriver();
    resumeHighlightDriverRef.current = null;
    activeUtterLenRef.current = 0;
    isRunningRef.current = false;
    window.speechSynthesis.cancel();
    clearReadAlongCssHighlight();
    stickyDefaultVoiceUriRef.current = null;
    isPausedRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setActiveParagraphId(null);
    setHighlight(null);
  }, []);

  const speakFrom = useCallback(
    (startParagraphIndex: number, startPlainCharOffset: number) => {
      if (!isSupported) {
        return;
      }

      window.speechSynthesis.cancel();
      clearReadAlongCssHighlight();
      clearUtteranceHighlightDriver();
      resumeHighlightDriverRef.current = null;

      const list = listRef.current;
      if (list.length === 0) {
        return;
      }

      const safeIdx = Math.max(0, Math.min(startParagraphIndex, list.length - 1));
      const p0 = list[safeIdx];
      const plain0 = p0 ? readAlongPlainForParagraph(p0) : '';
      const safeOff = Math.max(0, Math.min(startPlainCharOffset, plain0.length));

      startParaIdxRef.current = safeIdx;
      startPlainOffRef.current = safeOff;
      indexRef.current = safeIdx;
      isRunningRef.current = true;
      readAlongSyncRef.current = { time: 0, heardExclusiveUtter: 0 };
      paceAnchorRef.current = { time: 0, charIndex: 0 };
      setIsRunning(true);
      setIsPaused(false);

      const speakNext = () => {
        clearUtteranceHighlightDriver();
        if (!isRunningRef.current) {
          return;
        }

        const plist = listRef.current;
        const i = indexRef.current;
        if (i >= plist.length) {
          isRunningRef.current = false;
          setIsRunning(false);
          setActiveParagraphId(null);
          setHighlight(null);
          return;
        }

        const p = plist[i];
        liveParagraphIdxRef.current = i;

        const fullPlain = readAlongPlainForParagraph(p);
        const sliceStart =
          i === startParaIdxRef.current ? Math.min(startPlainOffRef.current, fullPlain.length) : 0;
        const rawSlice = fullPlain.slice(sliceStart);
        const leadMatch = rawSlice.match(/^\s+/);
        const leadTrimLen = leadMatch ? leadMatch[0].length : 0;
        const utterText = rawSlice.slice(leadTrimLen);
        const base = sliceStart + leadTrimLen;

        if (!utterText.trim()) {
          indexRef.current = i + 1;
          speakNext();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(utterText);
        utterance.rate = 0.92;
        attachVoiceToUtterance(utterance);

        function inferTokenLengthFromIndex(text: string, charIndex: number): number {
          const slice = text.slice(charIndex);
          if (!slice.length) {
            return 0;
          }
          const token = slice.match(/^\S+/);
          return token ? token[0].length : 1;
        }

        setActiveParagraphId(p.id);
        liveCharEndRef.current = base;

        utterance.onstart = () => {
          const now = performance.now();
          readAlongSyncRef.current = { time: now, heardExclusiveUtter: 0 };
          paceAnchorRef.current = { time: 0, charIndex: 0 };
          lastHighlightKeyRef.current = '';
          activeUtterLenRef.current = utterText.length;
          utterWallStartRef.current = performance.now();
          utterCharsPerSecRef.current = Math.max(
            READ_ALONG_CHARS_PER_SEC_INITIAL,
            paceCharsPerMsRef.current * 1000 * 1.08,
          );

          function paceForExtrapolation(): number {
            return (
              Math.max(READ_ALONG_MIN_PACE_CHARS_PER_MS, paceCharsPerMsRef.current) * READ_ALONG_PACE_BOOST
            );
          }

          function applyHighlightTick(): boolean {
            if (!isRunningRef.current || liveParagraphIdxRef.current !== i) {
              return false;
            }
            if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
              return false;
            }
            const syn = window.speechSynthesis;
            if (!syn.speaking || syn.paused || isPausedRef.current) {
              return false;
            }
            const t = performance.now();
            const sync = readAlongSyncRef.current;
            const utterLen = utterText.length;
            const syncHeard = Math.min(
              utterLen,
              sync.heardExclusiveUtter + paceForExtrapolation() * (t - sync.time),
            );
            const wallSec = (t - utterWallStartRef.current) / 1000;
            const wallHeard = wallSec * utterCharsPerSecRef.current * READ_ALONG_WALL_CLOCK_SEC_GAIN;
            const heardExclusive = Math.min(utterLen, Math.max(syncHeard, wallHeard));
            const span = activeWordSpanFromHeardExclusive(utterText, heardExclusive);
            const charStart = base + span.start;
            const charEnd = base + span.end;
            const highlightKey = `${p.id}:${charStart}:${charEnd}`;
            if (highlightKey !== lastHighlightKeyRef.current) {
              lastHighlightKeyRef.current = highlightKey;
              setHighlight({ paragraphId: p.id, charStart, charEnd });
            }
            liveCharEndRef.current = base + heardExclusive;
            return true;
          }

          function loop() {
            utterHighlightRafRef.current = null;
            const shouldContinue = applyHighlightTick();
            if (shouldContinue && isRunningRef.current && liveParagraphIdxRef.current === i) {
              utterHighlightRafRef.current = requestAnimationFrame(loop);
            }
          }

          function startHighlightDriver() {
            clearUtteranceHighlightDriver();
            applyHighlightTick();
            utterHighlightRafRef.current = requestAnimationFrame(loop);
          }

          resumeHighlightDriverRef.current = startHighlightDriver;
          startHighlightDriver();
        };

        utterance.onboundary = (ev) => {
          const e = ev as SpeechSynthesisEvent;
          const boundaryName = typeof e.name === 'string' ? e.name.toLowerCase() : '';
          if (boundaryName === 'sentence') {
            return;
          }
          if (typeof e.charIndex !== 'number') {
            return;
          }
          const ic = Math.min(Math.max(0, e.charIndex), utterText.length);
          let len =
            typeof e.charLength === 'number' && Number.isFinite(e.charLength) ? Math.max(0, e.charLength) : 0;
          if (len <= 0) {
            len = inferTokenLengthFromIndex(utterText, ic);
          }
          if (len <= 0) {
            return;
          }
          const now = performance.now();

          // Fix: track charIndex (word start) differences — not wordEnd differences.
          // Old approach used (wordEnd_cur - wordEnd_prev) / dt, which mixed "end of future word"
          // with "time to speak previous word", producing wildly inflated rates for short words.
          const anchor = paceAnchorRef.current;
          if (anchor.time > 0 && ic > anchor.charIndex) {
            const dc = ic - anchor.charIndex;
            const dt = now - anchor.time;
            if (dt > 0) {
              const inst = dc / dt;
              paceCharsPerMsRef.current = paceCharsPerMsRef.current * 0.65 + inst * 0.35;
            }
          }
          paceAnchorRef.current = { time: now, charIndex: ic };

          const elapsed =
            typeof e.elapsedTime === 'number' && Number.isFinite(e.elapsedTime)
              ? Math.max(0, e.elapsedTime)
              : null;

          // Fix: use cumulative rate charIndex/elapsed for utterCharsPerSecRef.
          // Old inter-event approach (wordEnd_delta / elapsed_delta) oscillated 5–73 chars/sec.
          // Cumulative rate converges smoothly from the first event.
          if (elapsed !== null && elapsed > 0 && ic > 0) {
            const cumCps = ic / (elapsed / 1000);
            if (cumCps > 2.5 && cumCps < 60) {
              utterCharsPerSecRef.current = utterCharsPerSecRef.current * 0.4 + cumCps * 0.6;
            }
          }

          const sync = readAlongSyncRef.current;
          const pace =
            Math.max(READ_ALONG_MIN_PACE_CHARS_PER_MS, paceCharsPerMsRef.current) * READ_ALONG_PACE_BOOST;
          const extrapolated = sync.heardExclusiveUtter + pace * (now - sync.time);

          // Fix: place highlight at the middle of the word the engine just announced.
          // This is accurate because boundary events fire at word START; ic+ceil(len/2)
          // lands in the current word so the RAF loop can smoothly advance through its end.
          // Cap extrapolated to the current word's end to prevent skipping ahead.
          const boundaryHeard = Math.min(utterText.length, ic + Math.ceil(len / 2));
          const cappedExtrapolated = Math.min(ic + len, extrapolated);
          const heardExclusiveUtter = Math.min(
            utterText.length,
            Math.max(boundaryHeard, cappedExtrapolated),
          );
          readAlongSyncRef.current = { time: now, heardExclusiveUtter };

          const span = activeWordSpanFromHeardExclusive(utterText, heardExclusiveUtter);
          const charStart = base + span.start;
          const charEnd = base + span.end;
          const highlightKey = `${p.id}:${charStart}:${charEnd}`;
          if (highlightKey !== lastHighlightKeyRef.current) {
            lastHighlightKeyRef.current = highlightKey;
            setHighlight({ paragraphId: p.id, charStart, charEnd });
          }
          liveCharEndRef.current = base + heardExclusiveUtter;
        };

        utterance.onend = () => {
          activeUtterLenRef.current = 0;
          resumeHighlightDriverRef.current = null;
          clearUtteranceHighlightDriver();
          liveCharEndRef.current = readAlongPlainForParagraph(p).length;
          indexRef.current = i + 1;
          speakNext();
        };

        utterance.onerror = (ev) => {
          if (!isRunningRef.current) {
            return;
          }
          const err = (ev as SpeechSynthesisErrorEvent).error;
          if (err === 'canceled' || err === 'interrupted') {
            activeUtterLenRef.current = 0;
            resumeHighlightDriverRef.current = null;
            clearUtteranceHighlightDriver();
            return;
          }
          activeUtterLenRef.current = 0;
          resumeHighlightDriverRef.current = null;
          clearUtteranceHighlightDriver();
          liveCharEndRef.current = readAlongPlainForParagraph(p).length;
          indexRef.current = i + 1;
          speakNext();
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    },
    [isSupported],
  );

  const skipSeconds = useCallback(
    (deltaSec: number) => {
      if (!isSupported || !isRunningRef.current) {
        return;
      }
      window.speechSynthesis.cancel();
      clearReadAlongCssHighlight();
      clearUtteranceHighlightDriver();

      const list = listRef.current;
      if (list.length === 0) {
        return;
      }

      const paraIdx = Math.max(0, Math.min(liveParagraphIdxRef.current, list.length - 1));
      const lenHere = readAlongPlainForParagraph(list[paraIdx]).length;
      const pos = Math.max(0, Math.min(liveCharEndRef.current, lenHere));
      const pace = Math.max(0.004, paceCharsPerMsRef.current);
      const deltaChars = Math.round(deltaSec * 1000 * pace);
      const resolved = resolveSkipInChapter(list, paraIdx, pos, deltaChars);
      speakFrom(resolved.idx, resolved.off);
    },
    [isSupported, speakFrom],
  );

  const playAll = useCallback(() => {
    speakFrom(0, 0);
  }, [speakFrom]);

  const pause = useCallback(() => {
    if (!isSupported || !isRunning) {
      return;
    }
    window.speechSynthesis.pause();
    isPausedRef.current = true;
    const t = performance.now();
    const sync = readAlongSyncRef.current;
    const utterLen = activeUtterLenRef.current;
    if (utterLen > 0) {
      const pace =
        Math.max(READ_ALONG_MIN_PACE_CHARS_PER_MS, paceCharsPerMsRef.current) * READ_ALONG_PACE_BOOST;
      const heardExclusive = Math.min(utterLen, sync.heardExclusiveUtter + pace * (t - sync.time));
      readAlongSyncRef.current = { time: t, heardExclusiveUtter: heardExclusive };
    }
    clearUtteranceHighlightDriver();
    setIsPaused(true);
  }, [isSupported, isRunning]);

  const resume = useCallback(() => {
    if (!isSupported) {
      return;
    }
    window.speechSynthesis.resume();
    isPausedRef.current = false;
    const now = performance.now();
    readAlongSyncRef.current = {
      time: now,
      heardExclusiveUtter: readAlongSyncRef.current.heardExclusiveUtter,
    };
    resumeHighlightDriverRef.current?.();
    setIsPaused(false);
  }, [isSupported]);

  useEffect(() => {
    return () => {
      clearUtteranceHighlightDriver();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      clearReadAlongCssHighlight();
    };
  }, []);

  useEffect(() => {
    if (!activeParagraphId) {
      return;
    }
    const safeId = activeParagraphId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = document.querySelector(`[data-paragraph-id="${safeId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeParagraphId]);

  useEffect(() => {
    function kickVoices() {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        void window.speechSynthesis.getVoices();
      }
    }
    window.addEventListener('voiceschanged', kickVoices);
    kickVoices();
    return () => window.removeEventListener('voiceschanged', kickVoices);
  }, []);

  return {
    isSupported,
    isRunning,
    isPaused,
    activeParagraphId,
    highlight,
    playAll,
    playFrom: speakFrom,
    pause,
    resume,
    stop,
    skipSeconds,
  };
}
