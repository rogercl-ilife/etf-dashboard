-- Week 7: feedback workflow columns + policies
-- Run after week6 setup.

alter table public.user_feedback
  add column if not exists status text not null default 'new',
  add column if not exists handled_at timestamptz,
  add column if not exists handled_note text;

create index if not exists idx_user_feedback_status_created_at
  on public.user_feedback (status, created_at desc);

alter table public.user_feedback enable row level security;

drop policy if exists "authenticated_select_feedback" on public.user_feedback;
create policy "authenticated_select_feedback"
  on public.user_feedback
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "authenticated_update_feedback" on public.user_feedback;
create policy "authenticated_update_feedback"
  on public.user_feedback
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
