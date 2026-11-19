import type {
  AcademicLevel,
  ExplanationLevel,
  FoundationalPaper,
  StudentProfile,
} from "@/lib/types";

export const ACADEMIC_LEVELS: { value: AcademicLevel; label: string; hint: string }[] = [
  { value: "undergraduate", label: "Undergraduate", hint: "Starting out in a lab or doing independent research" },
  { value: "masters", label: "Master's student", hint: "Coursework plus a research project or thesis" },
  { value: "phd", label: "PhD student", hint: "Working on a specialised research question" },
  { value: "postdoc", label: "Postdoc / early-career", hint: "Moving into a new or adjacent field" },
  { value: "research_staff", label: "Research assistant / technician", hint: "Supporting a lab's projects" },
  { value: "other", label: "Something else", hint: "" },
];

export const ACADEMIC_LEVEL_LABEL = Object.fromEntries(
  ACADEMIC_LEVELS.map((l) => [l.value, l.label]),
) as Record<AcademicLevel, string>;

/** Life sciences first; the profile accepts any free-text field so other disciplines work too. */
export const SUGGESTED_FIELDS = [
  "Molecular biology",
  "Cell biology",
  "Microbiology",
  "Genetics & genomics",
  "Computational biology & bioinformatics",
  "Biochemistry",
  "Neuroscience",
  "Immunology",
  "Cancer biology",
  "Ecology & evolution",
  "Synthetic biology",
  "Biomedical engineering",
  "Pharmacology",
  "Public health & epidemiology",
];

export const EXPLANATION_LEVELS: { value: ExplanationLevel; label: string; detail: string }[] = [
  { value: "beginner", label: "Beginner", detail: "Plain language, every technical term explained" },
  { value: "intermediate", label: "Intermediate", detail: "Assumes core coursework in the field" },
  { value: "advanced", label: "Advanced", detail: "Concise and technical, like a journal club" },
];

export const EMPTY_STUDENT_PROFILE: StudentProfile = {
  academicLevel: null,
  field: "",
  researchQuestion: "",
  projectDescription: "",
  foundationalPapers: [],
  explanationLevel: null,
  updatedAt: null,
};

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const LEVELS = new Set<string>(ACADEMIC_LEVELS.map((l) => l.value));
const EXPLAIN = new Set<string>(EXPLANATION_LEVELS.map((l) => l.value));

function toPaper(v: unknown): FoundationalPaper | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const input = str(r.input, 300).trim();
  if (!input) return null;
  const opt = (k: string) => (typeof r[k] === "string" && r[k] ? (r[k] as string) : undefined);
  return {
    input,
    title: opt("title"),
    authors: opt("authors"),
    journal: opt("journal"),
    year: opt("year"),
    url: opt("url"),
    doi: opt("doi"),
    pmid: opt("pmid"),
    resolved: r.resolved === true,
  };
}

/**
 * Read the stored jsonb. Rows from before PaperPuffin hold an old-style
 * research profile (no `version`), which is not a student profile: those read
 * as empty rather than being misinterpreted.
 */
export function parseStudentProfile(raw: unknown): StudentProfile {
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 2) {
    return EMPTY_STUDENT_PROFILE;
  }
  const r = raw as Record<string, unknown>;
  return {
    academicLevel: LEVELS.has(r.academicLevel as string) ? (r.academicLevel as AcademicLevel) : null,
    field: str(r.field, 120),
    researchQuestion: str(r.researchQuestion, 600),
    projectDescription: str(r.projectDescription, 4000),
    foundationalPapers: (Array.isArray(r.foundationalPapers) ? r.foundationalPapers : [])
      .map(toPaper)
      .filter((p): p is FoundationalPaper => p !== null)
      .slice(0, 10),
    explanationLevel: EXPLAIN.has(r.explanationLevel as string)
      ? (r.explanationLevel as ExplanationLevel)
      : null,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}

export function serializeStudentProfile(p: StudentProfile): Record<string, unknown> {
  return { version: 2, ...p };
}

/** The explanation depth to start a paper at. */
export function defaultExplanationLevel(p: StudentProfile): ExplanationLevel {
  if (p.explanationLevel) return p.explanationLevel;
  switch (p.academicLevel) {
    case "undergraduate":
    case "research_staff":
      return "beginner";
    case "postdoc":
      return "advanced";
    default:
      return "intermediate";
  }
}

/** How complete the profile is, for a gentle nudge on the dashboard. */
export function profileCompleteness(p: StudentProfile): { done: number; total: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [Boolean(p.academicLevel), "academic level"],
    [Boolean(p.field.trim()), "research field"],
    [Boolean(p.researchQuestion.trim()), "research question"],
    [Boolean(p.projectDescription.trim()), "project description"],
    [p.foundationalPapers.length > 0, "foundational papers"],
  ];
  return {
    done: checks.filter(([ok]) => ok).length,
    total: checks.length,
    missing: checks.filter(([ok]) => !ok).map(([, name]) => name),
  };
}

/**
 * Pull a DOI or PMID out of what a student pastes: a bare DOI, a doi.org
 * link, a bare PMID, or a pubmed.ncbi.nlm.nih.gov link.
 */
export function parsePaperIdentifier(input: string): { doi: string } | { pmid: string } | null {
  const text = input.trim();
  const doi = text.match(/\b(10\.\d{4,9}\/[^\s"<>]+)/i)?.[1];
  if (doi) return { doi: decodeURIComponent(doi).replace(/[.,;)\]]+$/, "") };
  const pubmed = text.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})/i)?.[1];
  if (pubmed) return { pmid: pubmed };
  const pmid = text.match(/^(?:pmid:?\s*)?(\d{1,9})$/i)?.[1];
  if (pmid) return { pmid };
  return null;
}
