# Study Helper — project context

Canonical orientation for agents and humans. **Keep this file updated** when you add domains, routes, auth flows, or persistence. For a shorter map, see `docs/CONTEXT_INDEX.md`.

> **Cursor IDE:** Agent rules under `.cursor/rules/` are **gitignored** in this repo by design. In-repo canonical docs are this file and `docs/CONTEXT_INDEX.md`.

---

## What it is

A **React + Vite + TypeScript** web app for organizing study material by **master topic → books → chapters → paragraphs** (markdown). Users authenticate with **Supabase Auth**, store data in **Supabase Postgres** (RLS per user), call **LLM APIs** for explain / simplify / extractions, and use **browser TTS** for read-aloud with in-page highlighting.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| UI | React 18, Tailwind CSS |
| Routing | `react-router-dom` v6 |
| Backend | Supabase (Auth + Postgres + Row Level Security) |
| Markdown | `react-markdown` (lazy-loaded in reader) |
| PDF | `pdfjs-dist` (import / text extraction pipelines) |
| DnD | `@dnd-kit/*` (books / chapters ordering) |
| Build | Vite 5, `tsc --noEmit` in `npm run build` |

---

## Environment variables

Defined for Vite (`import.meta.env`):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |

`src/lib/supabase.ts` exports `isSupabaseConfigured` when URL/key are non-placeholder. `SupabaseConfigGate` blocks the app until configured.

**Never commit** `.env` or real keys (see `.gitignore`).

---

## Application entry and shell

| File | Role |
|------|------|
| `src/main.tsx` | React root, `BrowserRouter`, read-along highlight style registration |
| `src/App.tsx` | Routes, `AuthGate`, `AuthenticatedShell` (`SettingsPanel`, `MusicPlayerBar`, `PdfBookImportProvider`) |
| `src/context/AppContext.tsx` | Global state: user, settings, current topic/book/chapter, theme, settings panel; loads `user_settings` after login; sets `document.documentElement` theme + `--study-helper-reader-font` |
| `src/components/layout/SupabaseConfigGate.tsx` | Requires valid Supabase env before rendering children |
| `src/components/layout/AppErrorBoundary.tsx` | Top-level error boundary |

---

## Routes (authenticated unless noted)

| Path | Component | Notes |
|------|-----------|--------|
| `/` | `AuthPage` / redirect | Logged-in users → `/home` |
| `/home` | `HomePage` | Master topics list, create/edit topic |
| `/topic/:topicId` | `MasterTopicPage` | Tabs: books, formulas, definitions, summaries, comparisons |
| `/topic/:topicId/book/:bookId/chapter/:chapterId` | `ChapterReadingView` | Reader, selection tools, read-aloud, optional on-page edit |

Wildcard routes redirect to `/`.

---

## Data model (Postgres)

Migrations live in `supabase/migrations/`. All domain tables use **RLS** with `auth.uid() = user_id` style policies.

| Table | Purpose |
|-------|---------|
| `user_settings` | One row per user: LLM `provider`, `base_url`, `api_key`, `model`, optional `youtube_url`, `theme`, `reader_font_px`, `tts_engine`, `tts_voice_uri`, timestamps |
| `master_topics` | Top-level study areas |
| `books` | Books under a topic (`master_topic_id`, `order`) |
| `chapters` | Chapters under a book (`raw_content` legacy / import) |
| `paragraphs` | Ordered markdown blocks: `original`, optional `modified`, `active_version`, `pinned_note` |
| `extractions` | JSONB `content` per chapter + `type` (`formula` \| `definition` \| `summary` \| `comparison`); unique `(chapter_id, type)` |

**TypeScript types:** `src/types/index.ts`. **Row ↔ app mapping:** `src/lib/dbMappers.ts` (`UserSettingsRow`, `mapUserSettings`, `mapParagraph`, etc.).

PostgREST schema cache: several migrations end with `notify pgrst, 'reload schema';` after DDL.

---

## Auth

- `supabase.auth.onAuthStateChange` and `getSession` in `AppContext`.
- Logout clears user, settings, navigation targets, and closes panels.
- Protected routes wrap content in `AuthGate` (redirect to `/` if not signed in).

---

## AI (LLM) usage

| Area | Typical entry |
|------|----------------|
| HTTP adapter | `src/ai/adapter.ts` |
| Prompts | `src/ai/prompts.ts` |
| Hook | `src/hooks/useAI.ts` (explain, simplify, extraction helpers, etc.) |
| Settings | `UserSettings` passed into adapter; configured in `SettingsPanel` |

Settings test uses a minimal “ping” system message via `callAI`.

---

## Chapter reader and read-aloud

| Concern | Location |
|---------|----------|
| Chapter layout, load paragraphs, selection toolbar | `src/components/reader/ChapterReadingView.tsx` |
| Markdown + optional on-page edit | `src/components/reader/ParagraphBlock.tsx` |
| Markdown component map | `src/components/reader/markdownReaderComponents.tsx` |
| Plain text for TTS / offsets | `src/lib/readAlongParagraphPlain.ts`, `src/lib/markdownToSpeakable.ts` |
| DOM segments + CSS Highlight API | `src/lib/readAlongDomText.ts`, `src/lib/registerReadAlongHighlightStyles.ts`, `src/hooks/useReadAlongDomHighlight.ts` |
| Speech + sync heuristics | `src/hooks/useReadAlong.ts` |
| Toolbar | `src/components/reader/ReadAlongToolbar.tsx` |
| Skip increment (local) | `src/lib/readAlongSkipPersist.ts` |

Read-aloud aligns utterance text with DOM when `[data-read-along-root]` is present under `[data-paragraph-id]`.

---

## Theme and reader font

- **Theme:** `UserSettings.theme` (`light` \| `dark`), mirrored to `localStorage` via `src/lib/theme.ts`; `ThemeToggle` can PATCH settings.
- **Reader font:** `reader_font_px` in `user_settings`, CSS variable `--study-helper-reader-font` set from `AppContext`.
- **PostgREST column missing / stale cache:** helpers in `src/lib/themePersist.ts` (`isThemeColumnUnavailableError`, `isTtsColumnUnavailableError`, `isReaderFontColumnUnavailableError`) used by `SettingsPanel` upsert fallbacks.

---

## Music (YouTube)

- `user_settings.youtube_url` stores playlist or video URL.
- `MusicPlayerBar` + `useMusicPlayer` (YouTube IFrame API). Session persistence in `src/lib/musicSessionStorage.ts`.

---

## PDF import

- Context: `src/context/PdfBookImportContext.tsx`.
- UI: modals under `src/components/books/` (e.g. `ImportBookPdfModal.tsx`).
- Parsing / insertion helpers: `src/lib/pdfImport.ts`, `src/lib/pdfText.ts`, `src/lib/pdfChapterSegments.ts`, `src/lib/supabaseChapterInsert.ts`.

---

## Conventions (align with `.cursor/rules` + team prefs)

- One primary export per file where practical; avoid dead code and `any`.
- No inline object/array literals in JSX props — hoist to named variables.
- Boolean names: `is` / `has` / `can` / `should` prefixes.
- Import order: external → internal (`src/lib`, `src/context`, …) → relative.
- Async: handle errors at boundaries (Supabase `.error`, try/catch around AI calls).

---

## Scripts

```bash
npm run dev      # Vite dev server
npm run build    # tsc --noEmit && vite build
npm run preview  # Preview production build
```

---

## When to update this doc

Update **PROJECT_CONTEXT.md** and/or **docs/CONTEXT_INDEX.md** when you:

- Add or rename a **route** or major **screen**.
- Introduce a new **table**, **RLS** pattern, or **env var**.
- Add a **cross-cutting** concern (new provider, new storage, new global context).

---

_Last reviewed: align with repo layout and migrations at time of authoring._
