"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EMPTY_TOPIC, TopicForm, type TopicDraft } from "@/components/topics/TopicForm";
import { EXAMPLE_PROFILE } from "@/lib/data/profile";
import { useSignal } from "@/lib/store/SignalProvider";

/** /topics/new and /topics/[id]. */
export function TopicEditor({ id }: { id: string | null }) {
  const { topics } = useSignal();
  const router = useRouter();
  const topic = id ? topics.find((t) => t.id === id) : undefined;

  if (id && !topic) {
    return (
      <div className="px-6 py-16 text-center lg:px-10">
        <p className="text-[15px] font-medium text-ink">Topic not found</p>
        <Link href="/research" className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
          ← My Research
        </Link>
      </div>
    );
  }

  const initial: TopicDraft = topic
    ? { profile: topic.profile, sensitivity: topic.sensitivity, sources: topic.sources, active: topic.active }
    : EMPTY_TOPIC;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <Link href="/research" className="text-[12px] font-medium text-ink-muted hover:text-accent">
        ← My Research
      </Link>
      <header className="mt-3 max-w-3xl">
        <h1 className="font-display text-[26px] font-semibold text-ink">
          {topic ? topic.profile.program : "New topic"}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {topic
            ? "Changes apply from the next search."
            : "A topic is one research question you want papers on. Its first search looks back 30 days; after that, PaperPuffin searches every morning."}
        </p>
      </header>
      <div className="mt-6 max-w-3xl">
        <TopicForm
          id={id}
          initial={initial}
          example={topic ? undefined : EXAMPLE_PROFILE}
          submitLabel={topic ? "Save topic" : "Create topic"}
          canDelete={Boolean(topic) && topics.length > 1}
          onSaved={(savedId) => {
            if (!topic) router.push(`/topics/${savedId}`);
            router.refresh();
          }}
          onDeleted={() => {
            router.push("/research");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
