"use client";

import { useRouter } from "next/navigation";
import { EMPTY_PROFILE, ProfileForm } from "@/components/profile/ProfileForm";
import { EXAMPLE_PROFILE } from "@/lib/data/profile";

export function OnboardingForm() {
  const router = useRouter();
  return (
    <ProfileForm
      initial={EMPTY_PROFILE}
      example={EXAMPLE_PROFILE}
      submitLabel="Save and continue"
      onSaved={() => {
        router.push("/");
        router.refresh();
      }}
    />
  );
}
