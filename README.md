# Signal

**Know what changed before it changes your field.**

Signal reads each night's new biomedical literature: PubMed, bioRxiv,
medRxiv and ClinicalTrials.gov. It decides which few records matter to one
researcher's program and explains why. Each researcher has an account, a
research profile they maintain, and a ranked briefing every morning in the app
and in their inbox.

```
4,000 records read  →  25 assessed by Claude  →  11 likely relevant  →  3 worth reading
```

---

## How it works

```
             ┌ PubMed (profile query) ┐
 nightly ─→  ├ ClinicalTrials.gov     ├→ lexical prefilter ─→ Claude assesses ─→ stored per user
 cron        └ bioRxiv + medRxiv      ┘   (per profile)       each candidate
                                                                     │
                     briefing page + email  ←  rank with learned preferences
```

1. **Ingest.** PubMed and ClinicalTrials.gov are queried with each user's
   profile terms. bioRxiv and medRxiv cannot be searched by topic, so the whole
   window is fetched once and shared across users.
2. **Prefilter** (`lib/ranking/scoring.ts → prefilterScore`). A free,
   word-boundary match against the profile drops most of the volume. The top
   *N* candidates go on to the next step. Anything already assessed for that
   user is skipped, so no record is paid for twice.
3. **Assess** (`lib/ai/`). Claude reads each candidate with the researcher's
   profile and returns structured JSON. That JSON holds relevance, novelty,
   evidence and strategic scores, each with a reason, plus "why this matters to
   you", a plain-English explanation, key findings, limitations, and the
   authors' claims kept separate from Signal's interpretation.
4. **Rank** (`rankBriefing`). The AI's four dimensions are combined with a fifth,
   *user preference fit*, which is computed from weights learned through
   feedback. The combination happens at read time, so Save, Not relevant and
   Important re-rank the briefing instantly with no further AI call. HIGH is
   capped at three items.

Nightly runs send every user's candidates as one
[Message Batch](https://docs.claude.com/en/docs/build-with-claude/batch-processing).
That costs half as much and avoids serverless timeouts.
`/api/cron/finalize` collects the results, publishes the briefings and sends
the emails. **Refresh now** on the briefing page evaluates directly while the
user watches, with a 15-minute cooldown per user.

### Accounts and access

- Email and password sign-up through **Supabase Auth**. The email is confirmed
  by a link, and password reset and email change work the same way.
- **Pilot gate.** Anyone can register. Accounts are approved automatically if
  their email was invited from `/admin`; everyone else waits on a waitlist.
  Only approved accounts get briefings, so only they cost money.
- Every table has row level security on and **no policies**. The browser
  only talks to Supabase Auth. All data access runs in server code with the
  secret key, after the session is verified (`lib/auth/session.ts`).

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor:** run `supabase/migrations/0001_init.sql`.
3. **Authentication → URL Configuration:** set Site URL to your app URL, and
   add `https://<your-domain>/auth/confirm` (and
   `http://localhost:3000/auth/confirm`) to Redirect URLs.
4. **Authentication → Emails → SMTP Settings:** turn on custom SMTP. Supabase's
   built-in mailer only delivers to your own team's addresses and is heavily
   rate-limited. Resend works:
   host `smtp.resend.com`, port `465`, user `resend`, password = your Resend
   API key, sender = an address on your verified domain.
5. **Authentication → Emails → Templates:** make links work in any browser,
   not just the one that signed up. Change each link to point at
   `/auth/confirm` with a token hash:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - Change email address: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/settings`

   The default templates also work, as long as the link is opened in the same
   browser.

### 2. Resend

Verify a sending domain at [resend.com](https://resend.com). Use one API key
for the SMTP setting above and for `RESEND_API_KEY`, and set `EMAIL_FROM` to an
address on that domain.

### 3. Environment

Copy `.env.example` to `.env.local` and fill it in. On Vercel, add the same
variables under Settings → Environment Variables. Put your own email in
`ADMIN_EMAILS` so you can approve others.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run build
```

To trigger the nightly pipeline locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sweep
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/finalize   # once the batch has ended
```

### 5. Deploy

`vercel.json` schedules the sweep at 09:00 UTC and finalize at 10:30 UTC. Most
batches finish within an hour. On the Hobby plan each cron runs once a day. If
a batch is still running at 10:30, the briefing waits until the next
finalize. On Pro, change the finalize schedule to hourly (`0 * * * *`) so
late batches are picked up sooner.

---

## Cost

Each assessment is about 2.5k input tokens and 1–2k output tokens, thinking
included. With the defaults (Claude Opus 5.5, 25 candidates per user per
night, batch pricing), that comes to roughly **$0.50 per user per day**. On-demand
refreshes cost about twice as much per item because they don't use batches.
Levers: `SIGNAL_NIGHTLY_CANDIDATES`, `SIGNAL_ON_DEMAND_CANDIDATES`, and
`SIGNAL_MODEL=claude-sonnet-5-5` (about half the price).

## Layout

```
app/(auth)/        sign in, sign up, confirmation, password reset, server actions
app/(setup)/       onboarding (research profile), waitlist
app/(app)/         briefing, paper detail, saved, watchlist, profile, settings, admin
app/api/           on-demand briefings, cron sweep/finalize
app/auth/confirm   landing route for every emailed auth link
lib/ai/            prompt, schema, direct + batch evaluation (Anthropic SDK)
lib/briefing/      the pipeline: ingest → prefilter → assess → store
lib/ingestion/     PubMed, bioRxiv/medRxiv, ClinicalTrials.gov adapters
lib/ranking/       prefilter, composite score, tiers
lib/db/            data access (service-role Supabase client)
lib/email/         daily briefing email (Resend)
supabase/          schema
proxy.ts           session refresh + signed-out redirect
```

## Limits worth knowing

- The AI sees titles and abstracts (or registry summaries), not full text.
  Every detail page says so.
- bioRxiv's API serves 30 records per two-second page, so on-demand refreshes
  read only the last two days of preprints. The nightly sweep reads the full
  window.
- The preference model is a transparent online update over six learned
  traits, not a trained model. It is deliberately legible.
