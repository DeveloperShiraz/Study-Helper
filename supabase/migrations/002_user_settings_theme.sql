-- Persist UI theme per user (light / dark)

alter table user_settings
  add column if not exists theme text not null default 'light';

alter table user_settings drop constraint if exists user_settings_theme_check;
alter table user_settings
  add constraint user_settings_theme_check check (theme in ('light', 'dark'));
