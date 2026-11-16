-- Signal 2: event-driven monitoring.
--
-- Research profiles become monitoring topics (several per user). Briefings
-- become monitoring runs that record what each source returned and why the
-- run found what it found. Evaluations gain the topic they matched, plus
-- indexed relevance/significance so developments can be queried directly.
-- Periodic digests are stored as their own records.
--
-- Run once, after 0001_init.sql. Existing accounts, assessments, saved items
-- and feedback are preserved: each account's research profile becomes its
-- first topic, and every existing assessment is attached to that topic.

-- ------------------------------------------------------------------ topics
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- program, description, keywords, synonyms, genes, diseases, organisms,
  -- techniques, organizations, exclusions
  definition jsonb not null,
  sensitivity text not null default 'balanced',   -- broad | balanced | strict
  sources text[] not null default '{pubmed,clinicaltrials,biorxiv,medrxiv,europepmc}',
  active boolean not null default true,
  -- Set when the topic's first, longer look-back has run successfully.
  backfilled_at timestamptz,
  -- Last run in which this topic's sources were checked and the run completed.
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index topics_user_idx on public.topics (user_id, created_at);
alter table public.topics enable row level security;

insert into public.topics (user_id, definition, created_at)
select
  id,
  research_profile || jsonb_build_object(
    'synonyms', '[]'::jsonb,
    'organisms', '[]'::jsonb,
    'exclusions', '[]'::jsonb
  ),
  created_at
from public.profiles
where research_profile is not null;

-- --------------------------------------------------------- monitoring runs
alter table public.briefings rename to monitor_runs;
alter index public.briefings_user_created_idx rename to monitor_runs_user_created_idx;
alter index public.briefings_status_idx rename to monitor_runs_status_idx;

update public.monitor_runs
set mode = case mode when 'nightly' then 'scheduled' when 'on_demand' then 'manual' else mode end;
update public.monitor_runs set status = 'complete' where status = 'ready';

-- Per-topic, per-source results and funnel counts: see lib/monitoring/types.ts.
alter table public.monitor_runs add column diagnostics jsonb not null default '{}';
-- Emails are now sent as digests, not per run.
alter table public.monitor_runs drop column emailed_at;

-- ------------------------------------------------------------- evaluations
alter table public.evaluations rename column briefing_id to run_id;
alter index public.evaluations_briefing_idx rename to evaluations_run_idx;

alter table public.evaluations
  add column topic_id uuid references public.topics (id) on delete cascade,
  add column relevance smallint,
  add column significance text,              -- major | moderate | minor
  add column evaluated_at timestamptz,
  add column alerted_at timestamptz;

update public.evaluations e
set topic_id = (
  select t.id from public.topics t where t.user_id = e.user_id order by t.created_at limit 1
);

update public.evaluations
set
  relevance = round((assessment -> 'relevance' ->> 'score')::numeric)::smallint,
  evaluated_at = coalesce((assessment ->> 'evaluatedAt')::timestamptz, created_at)
where status = 'done' and assessment is not null;

create index evaluations_developments_idx
  on public.evaluations (user_id, evaluated_at desc)
  where status = 'done';

-- ------------------------------------------------------- digest settings
alter table public.profiles
  add column digest_frequency text not null default 'daily',  -- daily | weekly | monthly | important_only | off
  add column alerts_enabled boolean not null default true,
  add column last_digest_at timestamptz;

update public.profiles set digest_frequency = 'off' where email_digest = false;
alter table public.profiles drop column email_digest;

-- ----------------------------------------------------------------- digests
create table public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  frequency text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  -- The developments included, in the order shown. Never generated text:
  -- every entry is a stored, sourced assessment.
  publication_ids text[] not null default '{}',
  -- Counts and per-topic monitoring status at the time the digest was built.
  summary jsonb not null default '{}',
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index digests_user_idx on public.digests (user_id, period_end desc);
alter table public.digests enable row level security;
