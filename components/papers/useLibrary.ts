"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLibraryAction } from "@/lib/papers/actions";
import { useSignal } from "@/lib/store/SignalProvider";
import type { ReadingStatus } from "@/lib/types";

/**
 * Reading status and notes for one paper, with an optimistic local copy so
 * the control responds immediately while the server catches up.
 */
export function useLibraryEntry(publicationId: string) {
  const { library, libraryReady } = useSignal();
  const entry = library.get(publicationId);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState<{ status?: ReadingStatus | null; notes?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = override && "status" in override ? override.status ?? null : entry?.readingStatus ?? null;
  const notes = override && "notes" in override ? override.notes ?? "" : entry?.notes ?? "";

  const save = (patch: { readingStatus?: ReadingStatus | null; notes?: string }) =>
    startTransition(async () => {
      setError(null);
      setOverride((o) => ({
        ...o,
        ...("readingStatus" in patch ? { status: patch.readingStatus } : {}),
        ...("notes" in patch ? { notes: patch.notes } : {}),
      }));
      const result = await updateLibraryAction(publicationId, patch);
      if (!result.ok) setError(result.error);
      else if (!result.value.libraryReady) setError("Reading status and notes need the latest database update (migration 0004).");
      router.refresh();
    });

  return {
    ready: libraryReady,
    status,
    notes,
    viewedAt: entry?.viewedAt ?? null,
    pending,
    error,
    setStatus: (s: ReadingStatus | null) => save({ readingStatus: s }),
    setNotes: (n: string) => save({ notes: n }),
  };
}

export const READING_LABEL: Record<ReadingStatus, string> = {
  to_read: "To read",
  reading: "Reading",
  read: "Read",
};
