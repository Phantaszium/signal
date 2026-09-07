# Signal

**Know what changed before it changes your field.**

Scientific literature intelligence for biomedical researchers. Signal ingests a
large volume of publications, filters to the small subset relevant to a specific
research program, ranks what is left, and explains why each item matters to
*that* researcher.

The product thesis is visible on every screen:

```
1,248 items ingested  →  11 likely relevant  →  3 important
```

Signal's job is not to summarise everything. It is to decide what is worth your
attention, and to show its work.

---

## Quick start

### Local development

```bash
npm install
cp .env.example .env.local     # optional — the demo runs fine without it
npm run dev
```

Open http://localhost:3000.

No API keys, no database, no accounts. The app boots straight into a fully
populated briefing.

### Production verification

Run the same build Vercel will run, then serve it:

```bash
npm run build
npm start
```

Open http://localhost:3000 and confirm the briefing, a paper detail page, and
**Generate Today's Briefing** all work before deploying.

---

## The 30-second demo

1. **Open `/`.** The funnel headline answers "what is this and how much did it
   scan" immediately. Three HIGH cards sit under it, each with a
   *Why this matters to you* line.
2. **Click "Generate Today's Briefing".** A short progress sequence runs —
   searching → evaluating relevance → ranking significance — and resolves to the
   same three items. Tick *Include live PubMed results* to pull real records from
   NCBI; if PubMed is slow or unreachable it silently falls back to the demo
   corpus.
3. **Open the top paper.** Key findings, study design, limitations, the score
   breakdown that produced the ranking, and an **Evidence** section that keeps
   *what the authors report* strictly separate from *Signal's interpretation*.
4. **Press Important / Save / Not relevant.** The "What Signal has learned"
   panel in the sidebar moves, and scores re-rank live.

`Reset demo state` on `/profile` returns everything to its seeded values between
demos.

---

## Demo scenario

A fictional research program on **KRAS G12D in non-small-cell lung cancer**:

- **Interests** — KRAS G12D, NSCLC, acquired resistance, RAS/MAPK signaling,
  targeted therapy, tumor evolution
- **Watchlist** — Revolution Medicines, Mirati/BMS, Eli Lilly, Genentech/Roche

### About the demo data

**Every seeded publication is fictional.** Authors, findings, drug codenames,
DOIs and trial identifiers are invented. Venue names (bioRxiv, Nature Cancer,
…) are used only as realistic containers — no claim in the corpus should be
attributed to any real publication, author, or company. Seeded items carry a
`Demo` chip in the UI and a disclaimer on their detail page.

Live PubMed results, when enabled, are real records and are labelled `PubMed`.
Signal does not generate findings for them; it ranks their actual metadata.

---

## Architecture

```
app/
  page.tsx                 /            Today's Briefing
  profile/page.tsx         /profile     Research profile + editor
  saved/page.tsx           /saved       Saved and dismissed items
  watchlist/page.tsx       /watchlist   Tracked topics and organizations
  paper/[id]/page.tsx      /paper/[id]  Publication detail
  not-found.tsx                         404
  api/briefing/route.ts                 Ingestion endpoint

components/
  layout/      AppShell, Sidebar
  briefing/    FunnelHeadline, BriefingFeed, PaperCard, GenerateBriefing
  paper/       PaperDetail
  profile/     ProfileEditor, TagField
  saved/ watchlist/
  ui/          primitives (Chip, Button, ScoreBar, Panel, …)

lib/
  types.ts                 Data models
  constants.ts             Client-safe shared constants
  data/profile.ts          Default research profile + seeded preferences
  data/seed-papers.ts      Fictional demo corpus
  ingestion/pubmed.ts      NCBI E-utilities client (server-only) + normalization
  ingestion/pipeline.ts    ingest → normalize → filter → rank → briefing
  ranking/scoring.ts       Five transparent dimensions → Signal score
  ranking/explain.ts       "Why this matters to you" + ranking rationale
  preferences/model.ts     Preference weights updated by feedback
  store/persistence.ts     SignalRepository (localStorage today)
  store/SignalProvider.tsx Client store; runs ranking so feedback is instant
```

The separation that matters: **no component computes a score, and no scoring
code knows about React.** `lib/ranking/scoring.ts` is a pure function of
`(publication × profile × preference weights)`.

### The pipeline

```
PubMed (optional)  ┐
                   ├→ normalize → relevance filter → rank → tier → briefing
seed corpus        ┘
```

- **Normalize** — every source is mapped to a single `Publication` shape.
- **Filter** — items below `RELEVANCE_FLOOR` (38/100 research relevance) never
  reach the briefing. This is where most of the volume disappears.
- **Rank** — five dimensions, weighted into one Signal score.
- **Tier** — HIGH ≥ 74, NOTABLE ≥ 54, otherwise CONTEXT. HIGH is additionally
  capped at `MAX_HIGH_ITEMS = 3`: the product promises three, so it shows three.

### The ranking model

| Dimension | Weight | Driven by |
| --- | --- | --- |
| Research relevance | 32% | keyword / gene / disease / technique matches against the profile |
| User preference fit | 22% | learned preference weights × publication signals |
| Evidence strength | 18% | study type, cohort size, clinical vs in-vitro, replication |
| Novelty | 16% | novelty prior, recency, whether the claim is confirmatory |
| Strategic significance | 12% | competitive weight, tracked organizations, regulatory impact |

Every dimension returns its reasons alongside its score, which is what the
detail page renders. To retune the model, edit `DIMENSION_WEIGHTS` or a single
`score*` function — nothing else changes.

### Learning from feedback

`Important`, `Save`, `Read` and `Not relevant` each nudge a small weight vector
in `lib/preferences/model.ts`. Those weights feed the *user preference fit*
dimension, so ranking visibly responds, and they render as the confidence bars
under **What Signal has learned**. Bars that have moved from their seeded
baseline turn amber.

This is a deliberately simple online update rather than a learned model. It is
legible, it demonstrably changes ranking, and it can be replaced with real
personalization without touching a single call site.

---

## Persistence — read this before sending the link out

There is **no database and no server-side state**. Feedback, saved items,
dismissals, profile edits and the cached live-PubMed results all persist to the
visitor's own `localStorage`, behind the `SignalRepository` interface in
`lib/store/persistence.ts`. Nothing is written to disk on the server, which is
exactly what a serverless host requires.

What that means once the app is public:

| Behaviour | Consequence |
| --- | --- |
| Every visitor gets their own independent state | Two researchers can use the link at once without affecting each other's briefing |
| State is per-browser, per-device | The same person on laptop and phone sees two separate demos |
| Cleared site data / private window wipes it | Each visit starts from the seeded state — good for demos, and `Reset demo state` on `/profile` does it on demand |
| **You cannot see what researchers did** | No feedback, saved item, or profile edit reaches you. If you want to know what they clicked, you need a database or analytics — neither is built |

That last row is the real limitation of this build. It is fine for *showing*
the product and asking "would this save you time?", and insufficient for
*measuring* what they engaged with. Adding it later means implementing
`SignalRepository` against Postgres and swapping the export — no UI changes.

Supabase/Postgres was left out deliberately: it adds a setup step and a failure
mode to an app whose main requirement is working perfectly in front of a
researcher on bad conference wifi.

---

## PubMed integration

`lib/ingestion/pubmed.ts` builds a boolean query from the profile's keywords and
genes, then calls NCBI `esearch` → `esummary` → `efetch`. Signals (mechanistic,
clinical, in-vitro-only, resistance-related) are inferred conservatively from
title and abstract text, so live items get modest priors rather than confident
ones.

Every failure path — no network, timeout, rate limit, malformed response —
returns `null` and the pipeline falls back to the seeded corpus with a visible
note. **The demo cannot break because of an external API.**

No paid API is used anywhere.

---

## Deploying to Vercel

Signal is a stock Next.js App Router project. Vercel auto-detects it — there is
no `vercel.json`, no custom build command, and no output configuration to set.

### 1. Push to GitHub

Create an empty repository on GitHub (no README, no .gitignore — this repo has
both), then:

```bash
git remote add origin https://github.com/<your-username>/signal.git
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `signal` repository.
3. Leave every build setting at its default — Framework Preset should already
   read **Next.js**.
4. Click **Deploy**.

That is the whole deployment. **No environment variables are required**; the
app ships with its seed corpus and runs the complete demo without them.

### 3. Environment variables (all optional)

Add these under **Settings → Environment Variables** only if you want the live
PubMed path to be more robust in production.

| Variable | Required? | What it does | Exposure |
| --- | --- | --- | --- |
| *(none)* | — | The full demo works with zero configuration | — |
| `NCBI_API_KEY` | Optional | Raises the NCBI rate limit from 3 → 10 req/sec. Worth adding because serverless hosts share outbound IPs, so the unauthenticated per-IP limit is easier to trip. [Free key](https://account.ncbi.nlm.nih.gov/settings/) | **Server-side only** |
| `NCBI_TOOL_EMAIL` | Optional | Contact address NCBI asks API consumers to identify themselves with. Recommended alongside the key | **Server-side only** |

Both are read exclusively in `lib/ingestion/pubmed.ts`, which carries an
`import "server-only"` guard: if anyone ever imports that module from a client
component, **the build fails** rather than shipping the key to the browser.
Neither variable is prefixed `NEXT_PUBLIC_`, and the project uses no
`NEXT_PUBLIC_` variables at all — nothing reaches the client bundle.

Without a key, live PubMed still works; it is just likelier to hit a rate limit,
and rate limits degrade silently to the seed corpus.

### What happens if PubMed is down when you demo

Nothing visible breaks. **Generate Today's Briefing** defaults to the seeded
corpus, and the *Include live PubMed results* checkbox is opt-in. Even with it
ticked, every upstream failure — refused connection, 429 rate limit, malformed
response, or a hang — returns the seeded briefing with a short note instead of
an error. These four paths are verified, not assumed.

Ingestion also runs under a shared 7-second budget across its three NCBI calls,
so a slow upstream can never exceed the serverless function's time limit and
turn into a gateway error.

---

## What this MVP deliberately does not have

No authentication, billing, permissions, multi-tenancy, or ML infrastructure.
This is a researcher-validation build. Its purpose is to support one question:

> *"Would this actually save you time, and what would make you use it?"*
