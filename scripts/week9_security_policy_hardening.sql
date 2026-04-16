-- Week 9: Security Advisor warning fix (RLS Policy Always True)
-- Run in Supabase SQL Editor for existing environments.

begin;

-- user_feedback: remove permissive anon policies

drop policy if exists "anon_select_feedback" on public.user_feedback;
drop policy if exists "anon_update_feedback" on public.user_feedback;

-- Replace permissive anon insert policy
drop policy if exists "anon_insert_feedback" on public.user_feedback;
create policy "anon_insert_feedback"
  on public.user_feedback
  for insert
  to anon
  with check (char_length(message) between 1 and 2000);

-- user_read_events: remove permissive anon read policy

drop policy if exists "anon_select_read_events" on public.user_read_events;

-- Replace permissive anon insert policy
drop policy if exists "anon_insert_read_events" on public.user_read_events;
create policy "anon_insert_read_events"
  on public.user_read_events
  for insert
  to anon
  with check (
    char_length(page_path) > 0
    and char_length(session_id) > 0
  );

-- Optional admin access path via Supabase Auth users.
-- service_role continues to work (it bypasses RLS).

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

drop policy if exists "authenticated_select_read_events" on public.user_read_events;
create policy "authenticated_select_read_events"
  on public.user_read_events
  for select
  to authenticated
  using (auth.uid() is not null);

commit;
