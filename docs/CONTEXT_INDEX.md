# Context index — Study Helper

Short map from **feature / topic** to **code**. Full narrative: **`../PROJECT_CONTEXT.md`**.

## Routes

| Feature | File(s) |
|---------|---------|
| Route table | `src/App.tsx` |
| Login / signup | `src/components/auth/AuthPage.tsx` |
| Topic list | `src/components/home/HomePage.tsx`, `MasterTopicCard.tsx`, `NewTopicModal.tsx`, `EditTopicModal.tsx` |
| Topic workspace | `src/components/topic/MasterTopicPage.tsx`, `TopicTabNav.tsx` |
| Chapter reader | `src/components/reader/ChapterReadingView.tsx` |

## Layout and global UI

| Feature | File(s) |
|---------|---------|
| App state | `src/context/AppContext.tsx` |
| Header | `src/components/layout/AppHeader.tsx` |
| Settings drawer | `src/components/layout/SettingsPanel.tsx` |
| Theme toggle | `src/components/layout/ThemeToggle.tsx` |
| Supabase gate | `src/components/layout/SupabaseConfigGate.tsx` |
| Error boundary | `src/components/layout/AppErrorBoundary.tsx` |
| Logged-out placeholder | `src/components/layout/AuthenticatedSessionFallback.tsx` |

## Books and chapters (topic → books tab)

| Feature | File(s) |
|---------|---------|
| Books tab | `src/components/topic/tabs/BooksTab.tsx` |
| Book accordion / sort | `BookAccordion.tsx`, `SortableBookAccordion.tsx` |
| Add book / chapter | `AddBookModal.tsx`, `AddChapterModal.tsx`, `ChapterRow.tsx` |
| PDF import | `ImportBookPdfModal.tsx`, `PdfBookImportContext.tsx`, `src/lib/pdf*.ts`, `supabaseChapterInsert.ts` |

## Reader (chapter view)

| Feature | File(s) |
|---------|---------|
| Page shell + data load | `ChapterReadingView.tsx` |
| Paragraph markdown / edit | `ParagraphBlock.tsx` |
| Outline nav | `ChapterOutlineNav.tsx`, `chapterOutline.ts` — scroll targets headings via `data-heading-index` under `[data-read-along-root]` (not `getElementById`) |
| Version original/modified | `VersionToggle.tsx` |
| Text selection + toolbar | `useTextSelection.ts`, `SelectionToolbar.tsx` |
| Explain / simplify / pin popups | `ExplainPopup.tsx`, `SimplifyPopup.tsx`, `PinNotePopup.tsx` |
| Read-aloud bar | `ReadAlongToolbar.tsx` |
| Simplify version parsing | `parseSimplifyVersions.ts` |

## Read-aloud (TTS + highlight)

| Feature | File(s) |
|---------|---------|
| Speech + timing | `src/hooks/useReadAlong.ts` |
| DOM highlight hook | `useReadAlongDomHighlight.ts` |
| DOM text / CSS Highlight | `readAlongDomText.ts`, `registerReadAlongHighlightStyles.ts` |
| Plain text alignment | `readAlongParagraphPlain.ts`, `markdownToSpeakable.ts` |
| Selection → offset | `readAlongPlainOffset.ts` |
| Skip step persistence | `readAlongSkipPersist.ts` |
| Voice pick / URI | `pickSpeechSynthesisVoice.ts`, `ttsVoiceLocalFallback.ts` |

## Extractions (topic tabs)

| Feature | File(s) |
|---------|---------|
| Shared workbench | `src/components/topic/shared/ExtractionWorkbench.tsx` |
| Per-type tabs | `FormulasTab.tsx`, `DefinitionsTab.tsx`, `SummariesTab.tsx`, `ComparisonsTab.tsx` |
| AI hook usage | `useAI.ts` |

## AI adapter

| Feature | File(s) |
|---------|---------|
| Provider HTTP | `src/ai/adapter.ts` |
| Prompts | `src/ai/prompts.ts` |

## Music

| Feature | File(s) |
|---------|---------|
| Player bar | `MusicPlayerBar.tsx` |
| Player hook | `useMusicPlayer.ts` |
| Session keys | `musicSessionStorage.ts` |
| YouTube URL helpers | `youtubeIds.ts` |

## Supabase and types

| Feature | File(s) |
|---------|---------|
| Client | `src/lib/supabase.ts` |
| Row mappers / settings bounds | `dbMappers.ts` |
| Domain types | `src/types/index.ts` |
| PostgREST fallback helpers | `themePersist.ts` |
| Theme local default | `theme.ts`, `themePersist.ts` |

## Database migrations

| Order | File |
|-------|------|
| Core schema | `supabase/migrations/001_initial.sql` |
| Theme (if split) | `002_user_settings_theme.sql`, `004_ensure_user_settings_theme.sql` |
| TTS columns | `003_user_settings_tts.sql` |
| Reader font | `005_user_settings_reader_font.sql` |

## Config and styling

| Feature | File(s) |
|---------|---------|
| Vite entry | `src/main.tsx` |
| Global CSS | `src/index.css`, `tailwind.config.ts` |
| TTS engine labels | `ttsEngines.ts` |
| Provider URLs / models | `providerUrls.ts`, `providerModels.ts` |

---

_Update this index when you add a new top-level screen, tab, or integration._
