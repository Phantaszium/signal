# PaperPuffin

**Your research companion.** Discover more. Understand deeper. Stay curious.

PaperPuffin is an AI research companion for undergraduate and graduate student
researchers. A student tells it what they're working on; it finds new papers
and preprints relevant to their project, explains *why each one matters to
their research*, and helps them understand the paper at their level, always
separating what the paper reports from AI interpretation.

It is built first for the life sciences and computational biology, but
nothing in the data model is discipline-specific: topics are free text and
the research field is a free-text profile field.

## What students get

| Area | What it does |
|---|---|
| **Onboarding** (`/onboarding`) | Five short steps: academic level, field, research question, project description, foundational papers (DOI/PMID, resolved via Europe PMC), briefing frequency. AI suggests search terms from the description. Only a topic name and one search term are required. |
| **Home** (`/home`) | Recommended papers (last 14 days, priority first), weekly briefing summary, followed topics, Continue Reading, update status, "Find new papers". |
| **Discover** (`/discover`) | *Recommended for you*, filterable by topic, date, journal, relevance and read status, plus papers read and not recommended (for transparency). *Search the literature* runs live Europe PMC search (PubMed, PMC, preprints) with date, type, open-access and sort filters, Save, and "Explain for my research". |
| **Paper** (`/paper/[id]`) | Why it matters to your research, then a study guide at beginner, intermediate or advanced level: summary, research question, methods, key findings, limitations (author-stated vs AI critique), why it matters, concepts to understand, and what to check in the full text. Library status and notes. |
| **Briefings** (`/briefings`) | Current and past briefings with reading priorities ("read these first", then by topic). Assembled from stored assessments, never free-written. |
| **My Library** (`/library`) | Saved papers by reading status (to read, reading, read) and topic, with notes, why each was recommended, reading history, and dismissed papers. |
| **My Research** (`/research`) | Topics, editable research profile, briefing frequency, what PaperPuffin uses and has learned (with reset), search history. |

### Honesty rules the code enforces

- Every recommendation and search result links to its original source.
- AI text is labelled **AI interpretation**; restatements of the paper are labelled **From the paper**. Study-guide limitations are tagged *stated by the authors* or *AI critique*.
- The AI sees titles and abstracts only, and every explanation says so. The prompts forbid inventing numbers, results or citations.
- Foundational papers that can't be found are kept as entered and never given an invented title.
- "Learning" is described for what it is: feedback re-orders recommendations through six transparent weights (see `lib/preferences/model.ts`). It never decides what counts as relevant, and the student can reset it.

## How it works (pipeline)

```
 for each topic:                                   per user
   PubMed  ─┐                                        │
   ClinicalTrials.gov ─┼→ dedupe (id, DOI) → filter → AI assessment → developments → dashboard
   Europe PMC preprints ─┤    skip already       per topic   (Claude)     (relevance ≥     digests
   bioRxiv / medRxiv feed ─┘    assessed        sensitivity              topic threshold)  alerts
```

1. **Topics** (`/topics`). A user can have up to eight. Each topic has:
   - a research question;
   - keywords and synonyms;
   - genes, organisms and diseases;
   - techniques and companies;
   - optional exclusions;
   - a relevance sensitivity (broad, balanced or strict);
   - the sources to monitor.
2. **Retrieval** (`lib/monitoring/run.ts → gather`).
   - PubMed, ClinicalTrials.gov and Europe PMC are searched with each topic's
     terms. Europe PMC covers preprints from bioRxiv, medRxiv, Research Square,
     SSRN and others.
   - bioRxiv and medRxiv can't be searched by topic, so their daily feeds are
     read once per run and shared by all topics.
   - A topic's first check looks back 30 days. Later checks cover the time
     since the last full check, with overlap.
3. **De-duplication.** Records are de-duplicated by id and DOI. The same
   bioRxiv preprint from the feed and from Europe PMC gets the same id.
   Anything already assessed for the user is skipped, so no record is paid for
   twice.
4. **Prefilter** (`lib/ranking/scoring.ts → prefilterScore`). A free lexical
   screen per topic. How strict it is depends on the topic's sensitivity:
   - **broad:** any profile term;
   - **balanced:** needs a keyword, gene or organism;
   - **strict:** needs one of those plus a second term.

   Exclusion terms rule a record out. The run's assessment budget is shared
   round-robin across topics, so a broad topic can't starve a narrow one.
5. **Assessment** (`lib/ai/`). Claude reads each candidate against all of the
   user's topics and returns structured JSON:
   - which topic it bears on, and **relevance** (0–100) to that topic;
   - **significance** (major, moderate or minor), judged independently of
     relevance;
   - novelty, evidence and strategic scores;
   - what changed, as reported by the source;
   - why it matters to you, and implications (PaperPuffin's interpretation);
   - suggested next steps (labelled as AI suggestions);
   - key findings, limitations, and the authors' claims kept separate from
     PaperPuffin's inference.

   Relevance is semantic, so a record can match without using the topic's
   exact keywords.
6. **Developments** (`lib/developments.ts`). A development is an assessment
   whose relevance clears its topic's threshold: broad 40, balanced 50,
   strict 65.
   - **High priority:** relevance 60+ and major significance, or relevance
     85+ and at least moderate.
   - Learned preferences (Save, Not relevant, Important) change the *order*
     of developments, never whether a record counts as one.
7. **Diagnostics** (`lib/monitoring/diagnosis.ts`). Every run stores, per topic
   and per source, what was searched and what came back, and where records
   were filtered out. Monitoring status turns that into one plain statement:
   - "*N* new developments";
   - "No significant new developments", plus where the records stopped;
   - "Partly checked: PubMed could not be reached";
   - "Last check failed".

   A topic is never described as quiet when a source or the run failed.
8. **Digests and alerts** (`lib/digests/plan.ts`, `lib/email/digest.ts`).
   - Users choose a daily, weekly or monthly digest, important developments
     only, or no email.
   - Digests are assembled from stored developments in the period, not
     generated text. A quiet day sends no daily email; weekly and monthly
     digests report a quiet period as quiet, with each topic's status.
   - High-priority developments can trigger an immediate alert.

### Scheduling

Vercel Cron runs two jobs (`vercel.json`):

- `/api/cron/sweep` at 09:00 UTC checks every approved account's active topics
  and submits each account's candidates as one Message Batch, at half price.
- `/api/cron/finalize` at 10:30 UTC collects finished batches and closes their
  runs. Records the batch API declined are retried directly with a model
  fallback. It then sends alerts and builds any digests that are due.

Both jobs are idempotent: one scheduled run per user per 12 hours, atomic
claims for alerts and digest periods, and assessments keyed per user and
publication. **Find new papers** on Home runs the same check immediately,
with a 15-minute cooldown.

### Accounts and access

- Email and password sign-up through **Supabase Auth**, with email
  confirmation, password reset and email change.
- **Beta gate.** Anyone can register. Emails invited from `/admin` are
  approved automatically; everyone else waits. Only approved accounts are
  monitored, so only they cost money.
- Every table has row-level security on and **no policies**. The browser only
  talks to Supabase Auth. All data access runs in server code with the secret
  key, after the session is verified (`lib/auth/session.ts`).

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor:** run `supabase/migrations/0001_init.sql`, then
   `0002_monitoring.sql`, `0003_keep_assessments_on_topic_delete.sql` and
   `0004_paperpuffin_library.sql`. Each runs once. 0004 is additive (reading
   status, notes, reading history). Until it runs, the app still works and
   says those features are unavailable.
3. **Authentication → URL Configuration:**
   - Set Site URL to your app URL.
   - Add `https://<your-domain>/auth/confirm` and
     `http://localhost:3000/auth/confirm` to Redirect URLs.
4. **Authentication → Emails → SMTP Settings:** turn on custom SMTP.
   Supabase's built-in mailer only delivers to your own team's addresses and
   is heavily rate-limited. Resend works:
   - host `smtp.resend.com`, port `465`, user `resend`;
   - password: your Resend API key;
   - sender: an address on your verified domain.
5. **Authentication → Emails → Templates:** point each link at
   `/auth/confirm` with a token hash, so links work in any browser:
   - Confirm signup:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - Reset password:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - Change email address:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/settings`

### 2. Resend

1. Verify a sending domain at [resend.com](https://resend.com).
2. Use one API key for the SMTP setting above and for `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on that domain.

Without Resend, digests are still built and shown in the app; they just
aren't emailed.

### 3. Environment

1. Copy `.env.example` to `.env.local` and fill it in.
2. On Vercel, add the same variables under Settings → Environment Variables.
3. Put your own email in `ADMIN_EMAILS`, so your account is approved and can
   approve others.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run test:live  # retrieval check against the real sources (no database, no AI)
npm run build
```

To trigger scheduled monitoring locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sweep
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/finalize   # once the batch has ended
```

### 5. Deploy

On the Hobby plan each cron runs once a day. If a batch is still running at
10:30, its results and that account's digest wait until the next finalize. On
Pro, change the finalize schedule to hourly (`0 * * * *`).

---

## Cost

Each assessment is about 3k input tokens and 1–2k output tokens, thinking
included. With the defaults (Claude Opus 5.5 at batch pricing), that's roughly
$0.01–0.02 per assessment.

| What | Typical assessments | Typical cost |
|---|---|---|
| Scheduled check, per user | up to 25 | up to ~$0.50 |
| New topic's first 30-day look-back | 15 extra | ~$0.30 extra |
| Find new papers (no batch discount) | up to 12 | ~$0.25–0.50 |
| Explain for my research (search result) | 1 | ~$0.02; capped at 25 per user per day (`PAPERPUFFIN_DAILY_EXPLAINS`) |
| Study guide, per paper per level | 1 | ~$0.02–0.04; cached after the first time |
| Onboarding search-term suggestion | 1 | under $0.01 |

A quiet niche topic costs close to nothing. The cost is driven by how many
records match a topic's terms, which is why over-general terms are the main
thing to avoid.

Levers:
- `SIGNAL_NIGHTLY_CANDIDATES`
- `SIGNAL_ON_DEMAND_CANDIDATES`
- `SIGNAL_BACKFILL_CANDIDATES`
- `SIGNAL_MODEL=claude-sonnet-5-5`, about half the price

## Layout

```
app/page.tsx       public landing page (signed-in visitors go to /home)
app/(auth)/        sign in, sign up, confirmation, password reset
app/(setup)/       onboarding wizard, beta waitlist
app/(app)/         home, discover, briefings, library, research, paper detail,
                   topics/[id] (topic editor), monitoring (search history), settings, admin
app/api/runs       Find new papers: start a manual run, poll its progress
app/api/cron/      scheduled sweep and finalize
components/brand/  the puffin mascot, logo, loader and empty states
lib/ai/            assessment prompt and schema; student.ts = term suggestions and study guides
lib/papers/        server actions: live search, save, reading status/notes, explain, study guides
lib/profile/       student research profile (stored in profiles.research_profile) and its actions
lib/monitoring/    the pipeline (run.ts), run planning, diagnostics, topic status
lib/ingestion/     PubMed, ClinicalTrials.gov, Europe PMC (monitoring + live search), bioRxiv/medRxiv
lib/ranking/       prefilter and composite score
lib/db/            data access (service-role Supabase client)
lib/email/         briefing and alert emails (Resend)
supabase/          schema migrations
```

Old routes redirect: `/activity` → `/discover`, `/saved` → `/library`,
`/topics`, `/watchlist`, `/profile` → `/research` (see `next.config.ts`).

## Limits worth knowing

- The AI sees titles and abstracts (or registry summaries), not full text.
  Every assessment says so.
- bioRxiv's API serves 30 records per page and is sometimes very slow (over
  30 seconds a page). When the daily feed can't be read, the check is
  reported as partial. Europe PMC still covers bioRxiv and medRxiv preprints,
  a day or two later.
- Broad topics match more records than one check assesses. The best-matching
  are assessed first; lower-ranked matches outside the next check's window
  are not revisited.
- The preference model is a transparent online update over six learned
  traits, not a trained model.
