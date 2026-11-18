import { describe, expect, it } from "vitest";
import {
  EMPTY_STUDENT_PROFILE,
  defaultExplanationLevel,
  parsePaperIdentifier,
  parseStudentProfile,
  profileCompleteness,
  serializeStudentProfile,
} from "@/lib/profile/student";
import { studentBlock } from "@/lib/ai/prompt";

describe("student profile storage", () => {
  it("reads a pre-PaperPuffin research profile as empty, not as a student profile", () => {
    const legacy = { program: "KRAS G12D", description: "x", keywords: ["KRAS"] };
    expect(parseStudentProfile(legacy)).toEqual(EMPTY_STUDENT_PROFILE);
    expect(parseStudentProfile(null)).toEqual(EMPTY_STUDENT_PROFILE);
  });

  it("round-trips and drops invalid values", () => {
    const stored = serializeStudentProfile({
      ...EMPTY_STUDENT_PROFILE,
      academicLevel: "undergraduate",
      field: "Microbiology",
      researchQuestion: "Q",
      foundationalPapers: [{ input: "10.1/abc", resolved: true, title: "T" }],
    });
    expect(parseStudentProfile(stored).academicLevel).toBe("undergraduate");
    expect(parseStudentProfile(stored).foundationalPapers[0].title).toBe("T");
    expect(parseStudentProfile({ ...stored, academicLevel: "wizard", explanationLevel: "expert" })).toMatchObject({
      academicLevel: null,
      explanationLevel: null,
    });
  });

  it("starts explanations at a level matching the student", () => {
    expect(defaultExplanationLevel({ ...EMPTY_STUDENT_PROFILE, academicLevel: "undergraduate" })).toBe("beginner");
    expect(defaultExplanationLevel({ ...EMPTY_STUDENT_PROFILE, academicLevel: "phd" })).toBe("intermediate");
    expect(defaultExplanationLevel({ ...EMPTY_STUDENT_PROFILE, academicLevel: "postdoc" })).toBe("advanced");
    expect(defaultExplanationLevel({ ...EMPTY_STUDENT_PROFILE, academicLevel: "undergraduate", explanationLevel: "advanced" })).toBe(
      "advanced",
    );
  });

  it("reports what is missing", () => {
    expect(profileCompleteness(EMPTY_STUDENT_PROFILE)).toMatchObject({ done: 0, total: 5 });
  });
});

describe("parsePaperIdentifier", () => {
  it.each([
    ["10.1038/nmeth.4019", { doi: "10.1038/nmeth.4019" }],
    ["https://doi.org/10.1101/2024.01.02.123456.", { doi: "10.1101/2024.01.02.123456" }],
    ["https://pubmed.ncbi.nlm.nih.gov/12345678/", { pmid: "12345678" }],
    ["PMID: 31234567", { pmid: "31234567" }],
    ["31234567", { pmid: "31234567" }],
  ])("%s", (input, expected) => {
    expect(parsePaperIdentifier(input)).toEqual(expected);
  });

  it("rejects free text", () => {
    expect(parsePaperIdentifier("my favourite paper")).toBeNull();
  });
});

describe("studentBlock", () => {
  it("is empty without a profile and only lists resolved foundational papers", () => {
    expect(studentBlock(EMPTY_STUDENT_PROFILE)).toBe("");
    const block = studentBlock({
      ...EMPTY_STUDENT_PROFILE,
      academicLevel: "masters",
      foundationalPapers: [
        { input: "a", resolved: true, title: "Real paper", year: "2020" },
        { input: "b", resolved: false },
      ],
    });
    expect(block).toContain("Academic level: Master's student");
    expect(block).toContain("Foundational paper: Real paper (2020)");
    expect(block.match(/Foundational paper/g)).toHaveLength(1);
  });
});
