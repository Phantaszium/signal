"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * A timestamp in the viewer's own time zone. The server renders in UTC and
 * cannot know the viewer's zone, so the text is filled in on the client; the
 * server renders the `dateTime` attribute only, which avoids a hydration
 * mismatch.
 */
export function LocalTime({
  iso,
  options = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {client ? new Date(iso).toLocaleString("en-US", options) : ""}
    </time>
  );
}
