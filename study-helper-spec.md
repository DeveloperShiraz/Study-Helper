# Study Helper — Kiro Spec Document (v2)

## 1. Product Overview

**App Name:** Study Helper
**Purpose:** A lightweight, snappy web app that helps users study by organizing
content into Master Topics → Books → Chapters, then using AI to extract formulas,
definitions, summaries, and similarity comparisons. Users interact with text inline
(explain, simplify, pin notes) without ever leaving the reading view.

**Core Philosophy:**
- Every user has a completely private space — no shared data between accounts
- Each user brings their own AI API key — no shared keys, no abuse risk
- User stays in one place at all times — no full-page navigations during study
- Everything is saved to Supabase — no data loss on refresh, syncs across devices
- AI is contextual and non-intrusive — popups, not chat threads
- Fast, minimal UI — nothing distracts from studying

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Type safety, component model |
| Build Tool | Vite | Fast HMR, lightweight |
| Styling | Tailwind CSS | Utility-first, no CSS bloat |
| Auth + Database | Supabase | Auth, Postgres, RLS, per-user isolation |
| Drag & Drop | dnd-kit | Lightweight chapter reordering |
| Markdown Render | react-markdown | Render chapter content |
| AI Calls | fetch() direct from browser | Each user uses their own API key |
| Music | YouTube IFrame API | User pastes playlist URL, custom minimal UI |

**No custom backend. No server. Supabase is the backend.**

---

## 3. Authentication

### 3.1 Provider
Supabase Auth — email + password to start. Google OAuth can be added later with
minimal changes.

### 3.2 Flow

```
App loads
    ↓
supabase.auth.getSession() — checks existing session automatically
    ↓
No session → AuthPage (Login / Sign Up toggle)
    ↓
Logged in → fetch user_settings row
    ↓
No user_settings row → Settings panel opens automatically
"Let's get you set up. Enter your AI provider and key."
    ↓
Settings saved → Home page (user's Master Topics only)
```

### 3.3 Auth Page

Single page with toggle between Login and Sign Up.
No separate routes — just state toggle on the same component.

Fields:
- Email
- Password
- [Login] or [Create Account] button
- Toggle link: "Don't have an account? Sign up" / "Already have an account? Log in"

On success → Supabase sets session cookie automatically → app proceeds.

---

## 4. Database Schema (Supabase Postgres)

All tables include user_id referencing auth.users.
Row Level Security (RLS) is enabled on every table.
Users can only ever read/write their own rows.

---

### 4.1 user_settings

Stores per-user AI configuration and preferences.
One row per user. Created on first setup, updated via Settings panel.

```sql
create table user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  provider       text not null,
  base_url       text not null,
  api_key        text not null,
  model          text not null,
  youtube_url    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table user_settings enable row level security;

create policy "user manages own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

### 4.2 master_topics

```sql
create table master_topics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table master_topics enable row level security;

create policy "user manages own topics"
  on master_topics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

### 4.3 books

```sql
create table books (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  master_topic_id  uuid not null references master_topics(id) on delete cascade,
  title            text not null,
  "order"          integer default 0,
  created_at       timestamptz default now()
);

alter table books enable row level security;

create policy "user manages own books"
  on books for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

### 4.4 chapters

```sql
create table chapters (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  book_id        uuid not null references books(id) on delete cascade,
  title          text not null,
  "order"        integer default 0,
  raw_content    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table chapters enable row level security;

create policy "user manages own chapters"
  on chapters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

### 4.5 paragraphs

```sql
create table paragraphs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  chapter_id       uuid not null references chapters(id) on delete cascade,
  "order"          integer default 0,
  original         text not null,
  modified         text,
  active_version   text default 'original' check (active_version in ('original', 'modified')),
  pinned_note      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table paragraphs enable row level security;

create policy "user manages own paragraphs"
  on paragraphs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

### 4.6 extractions

Stores AI-extracted formulas, definitions, summaries, and comparisons.
Keyed per chapter and type so each chapter can be updated independently.

```sql
create table extractions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  chapter_id     uuid not null references chapters(id) on delete cascade,
  book_id        uuid not null references books(id) on delete cascade,
  type           text not null check (type in ('formula', 'definition', 'summary', 'comparison')),
  content        jsonb not null default '[]',
  last_updated   timestamptz default now(),
  unique (chapter_id, type)
);

alter table extractions enable row level security;

create policy "user manages own extractions"
  on extractions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

content is a JSONB array of extraction items:
```json
[
  {
    "id": "uuid",
    "text": "1 acre = 43,560 sq ft",
    "source_chapter": "Chapter 1",
    "source_book": "Principles of Real Estate"
  }
]
```

---

## 5. TypeScript Interfaces

```typescript
// types/index.ts

export interface UserSettings {
  userId: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  youtubeUrl?: string;
}

export type Provider =
  | 'openrouter'
  | 'openai'
  | 'deepseek'
  | 'nvidia'
  | 'anthropic'
  | 'custom';

export interface MasterTopic {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  userId: string;
  masterTopicId: string;
  title: string;
  order: number;
  createdAt: string;
}

export interface Chapter {
  id: string;
  userId: string;
  bookId: string;
  title: string;
  order: number;
  rawContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paragraph {
  id: string;
  userId: string;
  chapterId: string;
  order: number;
  original: string;
  modified: string | null;
  activeVersion: 'original' | 'modified';
  pinnedNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionItem {
  id: string;
  text: string;
  sourceChapter: string;
  sourceBook: string;
}

export interface Extraction {
  id: string;
  userId: string;
  chapterId: string;
  bookId: string;
  type: 'formula' | 'definition' | 'summary' | 'comparison';
  content: ExtractionItem[];
  lastUpdated: string;
}
```

---

## 6. Application Routes

```
/                         → AuthPage (if not logged in) or redirect to /home
/home                     → Home: list of user's Master Topics
/topic/:topicId           → Master Topic view (tabs)
/topic/:topicId/book/:bookId/chapter/:chapterId  → Chapter reading view
```

Route guard: any route except / redirects to / if no active Supabase session.

---

## 7. Pages & Components

### 7.1 Auth Page (/)

Single page. Toggle between Login and Sign Up.

```
+-----------------------------------------+
|          Study Helper                   |
|                                         |
|  Email    [                           ] |
|  Password [                           ] |
|                                         |
|            [  Log In  ]                 |
|                                         |
|   Don't have an account? Sign up        |
+-----------------------------------------+
```

---

### 7.2 Home Page (/home)

- Header: "Study Helper" + [Settings] + [Log Out]
- Lists user's Master Topics as cards
- [+ New Master Topic] → modal asks for title
- Click topic card → /topic/:topicId
- Empty state: "No topics yet. Create your first Master Topic."

---

### 7.3 Master Topic Page (/topic/:topicId)

Top navigation tabs:
```
[ Books ]  [ Formulas ]  [ Definitions ]  [ Comparisons ]  [ Summaries ]
```

---

#### Tab: Books

- Lists all books under this topic in order
- [+ Add Book] → modal: book title
- Each book expands (accordion) to show chapters
- Each chapter row has drag handle for reordering via dnd-kit, title, Edit and Delete buttons
- [+ Add Chapter] per book opens modal:
  1. Enter chapter title
  2. Paste chapter content (large textarea) — can paste one chapter or entire book at once
  3. [Save Chapter] → content split into paragraphs, saved to Supabase

Chapter Reordering: dnd-kit drag and drop. order field updated in Supabase immediately on drop.

---

#### Tab: Formulas

1. Select Book dropdown
2. Multi-select checkboxes for chapters
3. [Extract Formulas] → AI call using user's own key
4. Results grouped by chapter:

```
Book 1 — Principles of Real Estate

  Chapter 1:
    1 acre = 43,560 sq ft
    Commission = Sale Price x Commission Rate

  Chapter 2:
    Net Operating Income = Gross Income - Expenses
```

- No duplicates — prompt includes existing formulas list
- Each chapter row has [Update] to re-run extraction for that chapter only
- [Get All Updates] at top re-runs all selected chapters
- Saved to extractions table (upsert on chapter_id + type)

---

#### Tab: Definitions / Key Concepts

Same book/chapter selector as Formulas.

Results:
```
Chapter 1:
  Real Property
  The land, improvements permanently attached, and the bundle of rights.

  Personal Property
  Anything movable that is not permanently attached to land.
```

- Term on its own line
- Definition on next line
- Blank line between entries
- No bullets, no dashes, no symbols

Each chapter has [Update].

---

#### Tab: Similarity Comparisons

Same book/chapter selector.

Results:
```
Rent vs Lease
  Rent: Month-to-month payment for use of property.
  Lease: A fixed-term legal agreement between landlord and tenant.
  Key difference: Lease locks both parties in. Rent is flexible.

Deed vs Title
  Deed: The physical document that transfers ownership.
  Title: The legal concept of who owns the property.
  Key difference: You get the deed. Title is what it proves.
```

Short, digestible. Plain text, new line per idea. No paragraph walls.

---

#### Tab: Summaries

Same book/chapter selector.

Results:
```
Book 1 — Chapter 1:
  Real property includes land and anything permanently attached.
  Personal property is movable and not part of the land.
  Ownership is defined by a bundle of rights.
```

Each chapter has [Update].

---

### 7.4 Chapter Reading View

Core experience. Nothing navigates away. Everything is popups anchored to selection.

Layout:
```
+----------------------------------------------------------+
|  <- Back     Book / Chapter Title                  [Gear]|
+----------------------------------------------------------+
|                                                          |
|   Chapter 3 - Ownership Rights                          |
|                                                          |
|   Property = anything owned.                            |
|   Real property = land + improvements + rights.  [pin]  |
|   Personal property = movable stuff.                    |
|   [Original] [Modified (active)]                        |
|                                                          |
|   ------------------------------------------------------ |
|                                                          |
|   A fee simple estate represents the highest            |
|   form of ownership recognized in law...                |
|                                                          |
+----------------------------------------------------------+
|  Music: Lo-Fi Beats   |<  >|  >>|   Vol ---o---  [x]   |
+----------------------------------------------------------+
```

---

#### Text Selection Toolbar

User selects any text → floating toolbar appears anchored near selection:

```
  [ Explain ]  [ Simplify ]  [ Pin Note ]
```

Explain:
- Small popup appears near the selection
- AI explains selected text in plain language, 3 to 5 sentences
- [Pin This] saves explanation as pinned note on that paragraph
- Click outside to dismiss
- No chat history, no scrolling

Simplify:
- Popup opens showing the paragraph's current text
- AI returns exactly 2 rewritten versions (A and B)
- Plain text, one concept per line, no bullets

```
+--------------------------------------------------+
|  Simplify                                   [X]  |
+--------------------------------------------------+
|  Original                        [Use Original]  |
|  "Property is anything that can be owned..."     |
+--------------------------------------------------+
|  A  Property = anything owned.                   |
|     Real property = land + rights.               |
|     Personal property = movable stuff.           |
|                                  [Use This]      |
+--------------------------------------------------+
|  B  Two types: Real (land, stays put).           |
|     Personal (your stuff, moves with you).       |
|                                  [Use This]      |
+--------------------------------------------------+
|                          [Simplify Again]        |
+--------------------------------------------------+
```

- [Use This] sets paragraph modified field, active_version = modified, saves to Supabase
- [Use Original] sets active_version = original, saves to Supabase
- [Simplify Again] overwrites current modified with 2 new versions. No history kept.
- Original text is NEVER overwritten.

Pin Note:
- Small textarea popup anchored near selection
- User types their note
- [Save] stored in pinned_note field on that paragraph row in Supabase
- Pin icon appears at right margin of paragraph
- Click pin icon to see note inline with Edit and Delete options

---

#### Per-Paragraph Version Toggle

Every paragraph with a modified version shows a subtle toggle below it:

```
[Original]  [Modified (active)]
```

Clicking either updates active_version in Supabase immediately.

---

### 7.5 Settings Panel (Slide-in, all pages)

Gear icon top-right on every page. Slide-in panel from right.

```
+----------------------------------------+
|  AI Settings                      [X] |
+----------------------------------------+
|  Provider                              |
|  [ OpenRouter                      v ] |
|                                        |
|  Model                                 |
|  [ deepseek/deepseek-chat-v3        ]  |
|                                        |
|  API Key                               |
|  [ sk-or-hidden-key             [eye]] |
|                                        |
|  Base URL (auto-filled, editable)      |
|  [ https://openrouter.ai/api/v1     ]  |
|                                        |
|  [Test Connection]  [Save]             |
+----------------------------------------+
```

Provider to Base URL auto-fill:

| Provider   | Base URL                                  |
|------------|-------------------------------------------|
| OpenRouter | https://openrouter.ai/api/v1              |
| OpenAI     | https://api.openai.com/v1                 |
| DeepSeek   | https://api.deepseek.com/v1               |
| NVIDIA NIM | https://integrate.api.nvidia.com/v1       |
| Anthropic  | https://api.anthropic.com/v1              |
| Custom     | User enters manually                      |

- API key masked by default. Eye icon reveals it.
- [Test Connection] fires minimal API call. Shows Success or error message.
- [Save] upserts row in user_settings in Supabase.
- Settings are per-user. User 1's key is never visible to User 2.
- On first login with no settings row, panel opens automatically.

---

### 7.6 Music Player (Bottom bar, reading view only)

```
+------------------------------------------------------+
|  Music: Track Name Here   |<  >|  >>|  Vol ---o---  [X] |
+------------------------------------------------------+
```

- Music icon bottom-right when no playlist set. Click to paste YouTube URL.
- Playlist ID extracted from URL. Supports video URLs and playlist URLs.
- YouTube IFrame API loads player hidden in DOM.
- Custom controls: previous, play/pause, next, volume slider.
- [X] hides bar — music keeps playing.
- Playlist URL saved to user_settings.youtube_url in Supabase. Persists across devices.
- [Change] button to swap playlist URL.

---

## 8. AI Integration

### 8.1 Per-User Key Flow

```
User logs in
    ↓
Fetch user_settings from Supabase (their row only, RLS enforced)
    ↓
Store settings in React context (memory only)
    ↓
AI call fires from browser using THEIR key to THEIR provider
    ↓
No other user's key is ever loaded
```

### 8.2 API Adapter

```typescript
// ai/adapter.ts

export async function callAI(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings
): Promise<string> {
  if (settings.provider === 'anthropic') {
    return callAnthropic(userMessage, systemPrompt, settings);
  }
  return callOpenAICompatible(userMessage, systemPrompt, settings);
}

async function callOpenAICompatible(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}
```

### 8.3 AI Prompts

Simplify (returns exactly 2 versions):
```
System:
You are a study assistant. Rewrite text to be shorter and clearer without
changing the meaning. Return exactly 2 versions labeled A and B. One concept
per line. No bullet points, no dashes, no symbols, no markdown. Plain text only.
New line only when introducing a new concept. Do not change factual meaning.

User:
Rewrite this: "{selectedText}"
```

Explain:
```
System:
You are a study assistant. Explain this concept in simple plain English.
3 to 5 sentences max. Plain text only, no bullet points, no markdown.
Everyday language, no jargon.

User:
Explain this: "{selectedText}"
```

Extract Formulas:
```
System:
You are a study assistant. Extract every formula, equation, or numeric
relationship from this text. Include everything, even simple facts like
"1 acre = 43,560 sq ft". Plain text, one formula per line. No bullets,
no markdown. Do not duplicate any formula from this existing list:
{existingFormulas}. Format: Formula name (if any): formula.

User:
Extract all formulas from: "{chapterContent}"
```

Extract Definitions:
```
System:
You are a study assistant. Extract all key terms and their definitions.
Format: term on one line, definition on the next, blank line between entries.
Plain text only, no bullets, no dashes, no markdown. Keep definitions concise.

User:
Extract all definitions from: "{chapterContent}"
```

Similarity Comparisons:
```
System:
You are a study assistant. Find concepts that are easily confused and compare
them. Plain text only, no bullets, no markdown. Format:
Concept A vs Concept B
Concept A: one sentence.
Concept B: one sentence.
Key difference: one sentence.
[blank line between comparisons]
Keep each comparison short. Focus on differences, not similarities.

User:
Find and compare easily confused concepts in: "{chapterContent}"
```

Chapter Summary:
```
System:
You are a study assistant. Summarize this chapter. Plain text only, no bullets,
no markdown. One idea per line. Concise, key points only. No filler phrases.

User:
Summarize: "{chapterContent}"
```

---

## 9. Formatting Rules (App-Wide)

All AI output rendered in the app must follow these rules, enforced in every prompt:

1. No bullet points — never
2. No markdown symbols (no #, *, -, >)
3. No bold or italic
4. New line = new concept
5. Blank line = new section or new entry
6. Plain text only

Correct format example:
```
Property = anything owned.
Real property = land + improvements + rights.
Personal property = movable stuff.

Fee Simple Estate = highest form of ownership.
No conditions or limitations on the owner.
```

---

## 10. Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

.env file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These are the public Supabase keys. RLS ensures users cannot access each other's
data even with the anon key exposed in the frontend bundle.

---

## 11. State Management

React Context + useReducer. No external state library needed.

```typescript
// context/AppContext.tsx

interface AppState {
  user: User | null;
  settings: UserSettings | null;
  settingsPanelOpen: boolean;
  currentTopic: MasterTopic | null;
  currentBook: Book | null;
  currentChapter: Chapter | null;
}
```

Supabase session managed via supabase.auth.onAuthStateChange() listener.
User settings loaded once after login and stored in context for the session.

---

## 12. Component Tree

```
App
├── AuthGuard (wraps all routes, redirects to / if no session)
│
├── / → AuthPage
│       ├── LoginForm
│       └── SignUpForm
│
├── /home → HomePage
│       ├── AppHeader (logo + settings icon + logout)
│       ├── MasterTopicCard (x n)
│       └── NewTopicModal
│
├── /topic/:topicId → MasterTopicPage
│       ├── AppHeader
│       ├── TopicTabNav
│       ├── BooksTab
│       │   ├── BookAccordion (x n)
│       │   │   └── ChapterRow [dnd-kit sortable] (x n)
│       │   ├── AddBookModal
│       │   └── AddChapterModal
│       ├── FormulasTab
│       │   ├── BookChapterSelector
│       │   └── ExtractionList (type=formula)
│       ├── DefinitionsTab
│       │   ├── BookChapterSelector
│       │   └── ExtractionList (type=definition)
│       ├── ComparisonsTab
│       │   ├── BookChapterSelector
│       │   └── ExtractionList (type=comparison)
│       └── SummariesTab
│           ├── BookChapterSelector
│           └── ExtractionList (type=summary)
│
├── /topic/:topicId/book/:bookId/chapter/:chapterId
│       → ChapterReadingView
│           ├── ChapterHeader (breadcrumb + back button)
│           ├── ParagraphBlock (x n)
│           │   ├── ParagraphText (renders original or modified)
│           │   ├── VersionToggle
│           │   └── PinnedNoteIndicator
│           ├── SelectionToolbar (floating, appears on text select)
│           │   ├── ExplainButton → ExplainPopup
│           │   ├── SimplifyButton → SimplifyPopup
│           │   └── PinNoteButton → PinNotePopup
│           └── MusicPlayerBar (fixed bottom)
│
└── SettingsPanel (global slide-in, accessible from any page)
```

---

## 13. File and Folder Structure

```
study-helper/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env
├── package.json
│
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── lib/
    │   └── supabase.ts
    │
    ├── types/
    │   └── index.ts
    │
    ├── ai/
    │   ├── adapter.ts
    │   └── prompts.ts
    │
    ├── context/
    │   └── AppContext.tsx
    │
    ├── hooks/
    │   ├── useTextSelection.ts
    │   ├── useAI.ts
    │   └── useMusicPlayer.ts
    │
    └── components/
        ├── auth/
        │   └── AuthPage.tsx
        │
        ├── layout/
        │   ├── AppHeader.tsx
        │   └── SettingsPanel.tsx
        │
        ├── home/
        │   ├── HomePage.tsx
        │   ├── MasterTopicCard.tsx
        │   └── NewTopicModal.tsx
        │
        ├── topic/
        │   ├── MasterTopicPage.tsx
        │   ├── TopicTabNav.tsx
        │   ├── shared/
        │   │   ├── BookChapterSelector.tsx
        │   │   └── ExtractionList.tsx
        │   └── tabs/
        │       ├── BooksTab.tsx
        │       ├── FormulasTab.tsx
        │       ├── DefinitionsTab.tsx
        │       ├── ComparisonsTab.tsx
        │       └── SummariesTab.tsx
        │
        ├── books/
        │   ├── BookAccordion.tsx
        │   ├── ChapterRow.tsx
        │   ├── AddBookModal.tsx
        │   └── AddChapterModal.tsx
        │
        ├── reader/
        │   ├── ChapterReadingView.tsx
        │   ├── ParagraphBlock.tsx
        │   ├── VersionToggle.tsx
        │   ├── SelectionToolbar.tsx
        │   ├── ExplainPopup.tsx
        │   ├── SimplifyPopup.tsx
        │   └── PinNotePopup.tsx
        │
        └── music/
            └── MusicPlayerBar.tsx
```

---

## 14. Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "@supabase/supabase-js": "^2.44.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "react-markdown": "^9.0.1",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.0",
    "vite": "^5.3.0"
  }
}
```

Note: Dexie removed entirely. Supabase replaces all local storage needs.

---

## 15. Security Notes

- Supabase anon key is safe to expose in frontend — it only allows what RLS permits
- RLS policies ensure every query is automatically scoped to auth.uid()
- AI API keys are stored in Supabase under each user's own row only
- User 1's API key is fetched only when User 1 is authenticated — never exposed to others
- All AI calls are made directly from the user's browser using their own key
- No server ever sees, stores, or proxies AI API keys

---

## 16. First Launch Checklist

```
1.  User visits app
2.  No session found → AuthPage shown
3.  User creates account via Sign Up
4.  Supabase creates auth.users row automatically
5.  App redirects to /home
6.  No user_settings row found → Settings panel opens automatically
7.  "Let's get you set up. Pick your AI provider and enter your API key."
8.  User picks provider → base URL auto-fills
9.  User enters model name and API key
10. [Test Connection] → passes
11. [Save] → user_settings row created in Supabase
12. Settings panel closes
13. Home page shown: "No topics yet. Create your first Master Topic."
14. User creates topic → adds books → adds chapters
15. User opens a chapter → reading view loads
16. User selects text → toolbar appears near selection
17. User explores Formulas, Definitions, Comparisons, Summaries tabs
```