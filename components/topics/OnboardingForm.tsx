"use client";

import { useRouter } from "next/navigation";
import { EMPTY_TOPIC, TopicForm } from "@/components/topics/TopicForm";
import { EXAMPLE_PROFILE } from "@/lib/data/profile";

export function OnboardingForm() {
  const router = useRouter();
  return (
    <TopicForm
      id={null}
      initial={EMPTY_TOPIC}
      example={EXAMPLE_PROFILE}
      submitLabel="Start monitoring"
      onSaved={() => {
        router.push("/");
        router.refresh();
      }}
    />
  );
}
