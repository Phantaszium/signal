-- Signal: accounts, research profiles, ingested literature, AI evaluations.
--
-- Access model: every table has row level security ENABLED and NO policies.
-- The browser only ever talks to Supabase Auth; all data reads and writes go
-- through Next.js server code using the service-role key, after the server
-- has verified the session. With no policies, the public anon key can read or
-- write nothing in these tables even if someone calls the REST API directly.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  -- Pilot gate: unapproved accounts can sign in but cannot run briefings.
  approved boolean not null default false,
  research_profile jsonb,
  preference_weights jsonb,
  email_digest boolean not null default true,
  last_on_demand_at timestamptz,
  created_at timestamptz not null default now()
);

-- Emails an admin has invited. A signup from one of these is auto-approved.
create table public.approved_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

-- Create a profile row for every new auth user, auto-approving invited emails.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, approved)
  values (
    new.id,
    new.email,
    exists (select 1 from public.approved_emails a where lower(a.email) = lower(new.email))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step when a user confirms a new address.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ------------------------------------------------------------ publications
-- Shared across users: one row per real-world item, keyed by source id.
create table public.publications (
  id text primary key,                 -- e.g. pmid-123, biorxiv-10.1101/..., nct-NCT0123
  origin text not null,                -- pubmed | biorxiv | medrxiv | clinicaltrials
  type text not null,                  -- journal | preprint | trial | regulatory
  title text not null,
  abstract text not null default '',
  source text not null,                -- journal / server / registry name
  authors jsonb not null default '[]',
  organizations jsonb not null default '[]',
  published_at date not null,
  url text,
  doi text,
  ingested_at timestamptz not null default now()
);
create index publications_published_at_idx on public.publications (published_at desc);

-- ---------------------------------------------------------------- briefings
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,                  -- nightly | on_demand
  status text not null,                -- evaluating | ready | failed
  funnel jsonb not null default '{}',  -- { scanned, candidates, evaluated }
  source_counts jsonb not null default '{}',
  batch_id text,                       -- Anthropic message batch, nightly only
  error text,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index briefings_user_created_idx on public.briefings (user_id, created_at desc);
create index briefings_status_idx on public.briefings (status) where status = 'evaluating';

-- One AI assessment of one publication for one user. Re-evaluations replace
-- the row, so a user's history holds the latest judgement per item.
create table public.evaluations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  publication_id text not null references public.publications (id) on delete cascade,
  briefing_id uuid references public.briefings (id) on delete set null,
  prefilter_score integer not null,
  custom_id text,                      -- request id inside the nightly batch
  assessment jsonb,                    -- null until the model has answered
  status text not null,                -- pending | done | failed
  error text,
  created_at timestamptz not null default now(),
  primary key (user_id, publication_id)
);
create index evaluations_briefing_idx on public.evaluations (briefing_id);

-- --------------------------------------------------------- user item state
create table public.item_state (
  user_id uuid not null references public.profiles (id) on delete cascade,
  publication_id text not null references public.publications (id) on delete cascade,
  saved boolean not null default false,
  dismissed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, publication_id)
);

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  publication_id text not null references public.publications (id) on delete cascade,
  action text not null,                -- important | save | not_relevant | read
  created_at timestamptz not null default now()
);
create index feedback_user_idx on public.feedback (user_id, created_at desc);

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.approved_emails enable row level security;
alter table public.publications enable row level security;
alter table public.briefings enable row level security;
alter table public.evaluations enable row level security;
alter table public.item_state enable row level security;
alter table public.feedback enable row level security;
