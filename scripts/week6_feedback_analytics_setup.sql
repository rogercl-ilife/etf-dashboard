-- Week 6: feedback + read analytics tables
-- Run this in Supabase SQL editor before using the new features.

create table if not exists public.user_feedback (
  id bigserial primary key,
  message text not null,
  email text,
  page_path text,
  language text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_feedback_created_at on public.user_feedback (created_at desc);

create table if not exists public.user_read_events (
  id bigserial primary key,
  page_path text not null,
  symbol text,
  session_id text not null,
  language text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_read_events_created_at on public.user_read_events (created_at desc);
create index if not exists idx_user_read_events_symbol on public.user_read_events (symbol, created_at desc);
create index if not exists idx_user_read_events_session on public.user_read_events (session_id, created_at desc);

alter table public.user_feedback enable row level security;
alter table public.user_read_events enable row level security;

drop policy if exists "anon_insert_feedback" on public.user_feedback;
create policy "anon_insert_feedback"
  on public.user_feedback
  for insert
  to anon
  with check (char_length(message) between 1 and 2000);

drop policy if exists "anon_insert_read_events" on public.user_read_events;
create policy "anon_insert_read_events"
  on public.user_read_events
  for insert
  to anon
  with check (
    char_length(page_path) > 0
    and char_length(session_id) > 0
  );
