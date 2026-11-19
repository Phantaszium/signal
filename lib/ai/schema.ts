import { z } from "zod";

/**
 * The structured answer the model returns for one publication. Numeric ranges
 * are stated in the prompt and clamped in code rather than expressed here,
 * because structured outputs accept only a subset of JSON Schema keywords.
 */
const dimension = z.object({
  score: z.number().describe("0-100"),
  reason: z.string().describe("One sentence naming the specific thing that set this score."),
});

export const assessmentSchema = z.object({
  topic: z.string().describe("Label of the topic this record bears on most, e.g. T1"),
  relevance: dimension,
  significance: z.object({
    level: z.enum(["major", "moderate", "minor"]),
    reason: z.string(),
  }),
  novelty: dimension,
  evidence: dimension,
  strategic: dimension,
  summary: z.string(),
  whatChanged: z.string(),
  whyThisMatters: z.string(),
  implications: z.array(z.string()),
  nextSteps: z.array(z.string()),
  plainEnglish: z.string(),
  keyFindings: z.array(z.string()),
  studyDesign: z.string(),
  modelSystem: z.string(),
  limitations: z.array(z.string()),
  authorsReport: z.array(z.string()),
  signals: z.object({
    mechanistic: z.boolean(),
    inVitroOnly: z.boolean(),
    clinical: z.boolean(),
    negativeResult: z.boolean(),
    acquiredResistance: z.boolean(),
    cohortSize: z.number().nullable(),
  }),
  matchedInterests: z.array(z.string()),
  matchedOrganizations: z.array(z.string()),
  tags: z.array(z.string()),
});

export type ModelAssessment = z.infer<typeof assessmentSchema>;
