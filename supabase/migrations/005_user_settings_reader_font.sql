-- Reader font size (px) for chapter view. Idempotent.

alter table user_settings add column if not exists reader_font_px integer not null default 18;

alter table user_settings drop constraint if exists user_settings_reader_font_px_check;
alter table user_settings
  add constraint user_settings_reader_font_px_check check (reader_font_px >= 12 and reader_font_px <= 32);

notify pgrst, 'reload schema';
