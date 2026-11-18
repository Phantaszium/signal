-- PaperPuffin: reading status, personal notes and reading history for saved papers.
--
-- Run once, after 0003. Additive only: existing saved and dismissed items are
-- kept. Until this runs, the app still works; reading status, notes and
-- "recently viewed" are shown as unavailable.
--
-- The student research profile reuses profiles.research_profile (jsonb), and
-- per-paper study guides are stored inside evaluations.assessment, so neither
-- needs a schema change.

alter table public.item_state
  add column if not exists reading_status text,        -- to_read | reading | read
  add column if not exists notes text,
  add column if not exists viewed_at timestamptz;

create index if not exists item_state_viewed_idx
  on public.item_state (user_id, viewed_at desc)
  where viewed_at is not null;
