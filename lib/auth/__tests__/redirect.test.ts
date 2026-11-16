import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths and queries", () => {
    expect(safeNextPath("/paper/pmid-1?x=1")).toBe("/paper/pmid-1?x=1");
  });

  it.each(["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "evil", "", null])(
    "rejects %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );
});
