-- Study Helper schema (from study-helper-spec.md)
-- Safe to re-run: policies are dropped before recreate.

create table if not exists user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  provider       text not null,
  base_url       text not null,
  api_key        text not null,
  model          text not null,
  youtube_url    text,
  theme          text not null default 'light',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Existing DBs created before theme: add column + constraint (idempotent)
alter table user_settings add column if not exists theme text not null default 'light';
alter table user_settings drop constraint if exists user_settings_theme_check;
alter table user_settings
  add constraint user_settings_theme_check check (theme in ('light', 'dark'));

alter table user_settings enable row level security;

drop policy if exists "user manages own settings" on user_settings;
create policy "user manages own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists master_topics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table master_topics enable row level security;

drop policy if exists "user manages own topics" on master_topics;
create policy "user manages own topics"
  on master_topics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists books (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  master_topic_id  uuid not null references master_topics(id) on delete cascade,
  title            text not null,
  "order"          integer default 0,
  created_at       timestamptz default now()
);

alter table books enable row level security;

drop policy if exists "user manages own books" on books;
create policy "user manages own books"
  on books for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists chapters (
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

drop policy if exists "user manages own chapters" on chapters;
create policy "user manages own chapters"
  on chapters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists paragraphs (
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

drop policy if exists "user manages own paragraphs" on paragraphs;
create policy "user manages own paragraphs"
  on paragraphs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists extractions (
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

drop policy if exists "user manages own extractions" on extractions;
create policy "user manages own extractions"
  on extractions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
