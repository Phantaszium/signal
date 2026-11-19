import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, Puffin, type PuffinMood } from "@/components/brand/Puffin";
import { Icon, type IconName } from "@/components/ui/Icon";
import { currentUser } from "@/lib/auth/session";

export const metadata = {
  title: { absolute: "PaperPuffin — Your research companion" },
};

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "compass",
    title: "Never miss a relevant discovery.",
    body: "Personalized recommendations based on your research interests. PaperPuffin searches PubMed and preprint servers for the topics you follow, every morning.",
  },
  {
    icon: "sparkle",
    title: "Understand papers faster.",
    body: "Clear explanations of complex scientific findings, at a beginner, intermediate or advanced level, with the key concepts you need to learn.",
  },
  {
    icon: "briefing",
    title: "Stay current without the overload.",
    body: "Research briefings that highlight what actually matters. A quiet week is reported as quiet, not padded with weak matches.",
  },
  {
    icon: "library",
    title: "Build your research knowledge.",
    body: "Save papers, track topics, take notes and keep track of what you've read as your project grows.",
  },
];

const STEPS: { title: string; body: string; mood: PuffinMood }[] = [
  {
    title: "Tell PaperPuffin what you're researching.",
    body: "Describe your project in your own words. PaperPuffin suggests the search terms, and you can add papers your work builds on.",
    mood: "curious",
  },
  {
    title: "Discover papers relevant to your project.",
    body: "New papers and preprints are read against your topics. Each recommendation says specifically why it matters to your research.",
    mood: "default",
  },
  {
    title: "Understand the important findings.",
    body: "Open any paper for a study guide: the question, methods, findings, limitations, and the concepts behind them.",
    mood: "reading",
  },
  {
    title: "Stay updated as new research emerges.",
    body: "A weekly (or daily) briefing brings the most relevant new work to you, with suggestions for what to read first.",
    mood: "sleepy",
  },
];

/** An abstract preview of a recommendation card: shapes, not invented content. */
function PreviewCard() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -top-6 -right-4 hidden sm:block">
        <Puffin size={88} mood="reading" />
      </div>
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-[0_12px_40px_rgba(21,35,63,0.10)]">
        <div className="flex gap-1.5">
          <span className="h-4 w-14 rounded-full bg-canvas-deep" />
          <span className="h-4 w-24 rounded-full bg-canvas-deep" />
        </div>
        <div className="mt-3 h-4 w-11/12 rounded bg-ink/80" />
        <div className="mt-2 h-4 w-3/4 rounded bg-ink/80" />
        <div className="mt-2.5 h-3 w-1/2 rounded bg-ink-faint/40" />
        <div className="mt-4 rounded-2xl bg-accent-soft px-4 py-3">
          <p className="text-[11px] font-semibold text-accent">Why this matters to your research</p>
          <div className="mt-2 h-2.5 w-full rounded bg-accent/25" />
          <div className="mt-1.5 h-2.5 w-5/6 rounded bg-accent/25" />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-[12px] font-semibold text-accent">Understand this paper</span>
          <span className="flex gap-1.5">
            <span className="h-6 w-14 rounded-lg border border-line-strong" />
            <span className="h-6 w-16 rounded-lg border border-line-strong" />
          </span>
        </div>
      </div>
      <div className="relative -mt-3 ml-6 rounded-3xl border border-line bg-surface/90 p-4 shadow-[0_8px_30px_rgba(21,35,63,0.08)]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-sea-soft px-2 py-0.5 text-[10px] font-semibold text-sea">From the paper</span>
          <span className="rounded-full border border-dashed border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
            AI interpretation
          </span>
        </div>
        <div className="mt-2.5 h-2.5 w-full rounded bg-line" />
        <div className="mt-1.5 h-2.5 w-2/3 rounded bg-line" />
      </div>
    </div>
  );
}

export default async function LandingPage() {
  if (await currentUser()) redirect("/home");

  return (
    <div className="overflow-x-hidden">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <Link href="/" aria-label="PaperPuffin" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-1 text-[14px] whitespace-nowrap sm:gap-3">
            <a href="#how-it-works" className="hidden rounded-lg px-2 py-1.5 text-ink-muted hover:text-ink sm:block">
              How it works
            </a>
            <Link href="/login" className="rounded-lg px-2 py-1.5 font-medium text-ink-muted hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-xl bg-accent px-3 py-2 font-semibold text-white hover:bg-accent-strong sm:px-3.5">
              Get Started<span className="hidden sm:inline"> Free</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_70%_20%,var(--accent-soft),transparent),radial-gradient(40%_40%_at_10%_60%,var(--sea-soft),transparent)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-medium text-ink-muted">
                <span className="h-2 w-2 rounded-full bg-beak" /> For undergraduate and graduate researchers
              </p>
              <h1 className="mt-5 font-display text-[44px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink sm:text-[60px]">
                Your research
                <br />
                <span className="text-accent">companion.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-muted sm:text-[19px]">
                Discover relevant papers, understand complex findings, and stay current with the science that matters to you.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-2xl bg-beak px-6 py-3 text-[16px] font-semibold text-white shadow-[0_6px_20px_rgba(238,122,58,0.35)] hover:bg-high"
                >
                  Get Started Free
                </Link>
                <a href="#how-it-works" className="rounded-2xl border border-line-strong bg-surface px-6 py-3 text-[16px] font-semibold text-ink hover:border-ink-faint">
                  See How It Works
                </a>
              </div>
              <p className="mt-5 text-[13px] text-ink-faint">Discover more. Understand deeper. Stay curious.</p>
            </div>
            <PreviewCard />
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Icon name={f.icon} size={22} />
                </span>
                <h2 className="mt-4 text-[17px] leading-snug font-semibold text-ink">{f.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="eyebrow text-[12px] font-semibold text-accent">How it works</p>
            <h2 className="mt-2 max-w-2xl font-display text-[34px] leading-tight font-semibold text-ink sm:text-[40px]">
              From &ldquo;where do I even start?&rdquo; to knowing your field.
            </h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-3xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <span className="tabular flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <Puffin size={44} mood={s.mood} />
                  </div>
                  <h3 className="mt-5 text-[16.5px] leading-snug font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-[30px] leading-tight font-semibold">Grounded in real papers. Honest about what&rsquo;s AI.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/75">
                Every recommendation links to the original source. Explanations clearly separate what a paper reports from
                PaperPuffin&rsquo;s interpretation, and they say when they&rsquo;re based on the abstract rather than the full text.
              </p>
            </div>
            <ul className="grid gap-3 text-[14.5px] sm:grid-cols-2">
              {[
                ["Real sources", "PubMed, Europe PMC, bioRxiv and medRxiv."],
                ["Clearly labelled", "“From the paper” vs. “AI interpretation” on every explanation."],
                ["No invented citations", "Explanations only use the paper in front of them."],
                ["You stay in control", "Edit your profile, reset what it has learned, or delete your account."],
              ].map(([t, b]) => (
                <li key={t} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="flex items-center gap-2 font-semibold">
                    <Icon name="check" size={16} className="text-beak" /> {t}
                  </p>
                  <p className="mt-1 text-white/70">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            <Puffin size={84} mood="curious" className="mx-auto" />
            <h2 className="mt-5 font-display text-[34px] leading-tight font-semibold text-ink">Start your research journey.</h2>
            <p className="mt-3 text-[16px] text-ink-muted">
              Built first for the life sciences and computational biology. Set up takes about two minutes.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-block rounded-2xl bg-beak px-7 py-3.5 text-[16px] font-semibold text-white shadow-[0_6px_20px_rgba(238,122,58,0.35)] hover:bg-high"
            >
              Get Started Free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-ink-faint">
          <Logo size="sm" />
          <p>Literature data from PubMed/NCBI, Europe PMC, bioRxiv and medRxiv.</p>
        </div>
      </footer>
    </div>
  );
}
