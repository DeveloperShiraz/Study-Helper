-- Optional per-task AI profiles (JSON) + Amazon Bedrock IAM fields.
-- After apply: NOTIFY pgrst, 'reload schema'; in SQL Editor if PostgREST cache is stale.

alter table user_settings add column if not exists bedrock_access_key_id text;
alter table user_settings add column if not exists bedrock_region text default 'us-east-1';
alter table user_settings add column if not exists task_ai_overrides jsonb not null default '{}'::jsonb;
