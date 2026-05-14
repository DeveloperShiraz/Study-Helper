-- Read-aloud (TTS) preferences: separate from LLM provider / model.

alter table user_settings add column if not exists tts_engine text not null default 'browser';
alter table user_settings add column if not exists tts_voice_uri text;

alter table user_settings drop constraint if exists user_settings_tts_engine_check;
alter table user_settings
  add constraint user_settings_tts_engine_check check (tts_engine in ('browser'));

-- PostgREST keeps a schema cache; without this, APIs may still error until it reloads.
notify pgrst, 'reload schema';
