import type {
  LearnedPreference,
  PreferenceWeights,
  ResearchProfile,
} from "@/lib/types";

/** The demo researcher's program. Editable at /profile. */
export const DEFAULT_PROFILE: ResearchProfile = {
  program: "KRAS G12D / NSCLC",
  description:
    "We study acquired resistance to KRAS G12D-selective inhibitors in non-small-cell lung cancer. Our work combines patient-derived models and longitudinal ctDNA to map how RAS/MAPK rewiring drives escape from targeted inhibition, and to identify combination strategies that extend durability.",
  keywords: [
    "KRAS G12D",
    "NSCLC",
    "acquired resistance",
    "RAS/MAPK signaling",
    "targeted therapy",
    "tumor evolution",
  ],
  genes: ["KRAS", "SOS1", "SHP2", "MEK1", "ERK2", "EGFR", "MET", "NF1", "PTPN11"],
  diseases: [
    "non-small-cell lung cancer",
    "lung adenocarcinoma",
    "pancreatic ductal adenocarcinoma",
  ],
  techniques: [
    "patient-derived xenograft",
    "ctDNA sequencing",
    "single-cell RNA-seq",
    "CRISPR screening",
    "phosphoproteomics",
  ],
  organizations: [
    "Revolution Medicines",
    "Mirati/BMS",
    "Eli Lilly",
    "Genentech/Roche",
  ],
};

/**
 * Seeded "what Signal has learned" statements. Each maps to a preference key
 * that the scoring module reads, so these are not decorative — changing a
 * confidence here changes ranking.
 */
export const DEFAULT_LEARNED_PREFERENCES: LearnedPreference[] = [
  {
    id: "pref-mechanistic",
    statement: "You prioritize mechanistic studies over purely descriptive studies.",
    confidence: 0.86,
    key: "mechanistic",
  },
  {
    id: "pref-invitro",
    statement: "You read preprints, but discount in-vitro-only claims.",
    confidence: 0.74,
    key: "discountInVitroOnly",
  },
  {
    id: "pref-negative",
    statement: "You value well-powered negative results.",
    confidence: 0.68,
    key: "negativeResults",
  },
  {
    id: "pref-resistance",
    statement: "You frequently read studies involving acquired resistance.",
    confidence: 0.91,
    key: "acquiredResistance",
  },
];

/** Baseline weights before any feedback is applied. */
export const DEFAULT_PREFERENCE_WEIGHTS: PreferenceWeights = {
  mechanistic: 0.86,
  discountInVitroOnly: 0.74,
  negativeResults: 0.68,
  acquiredResistance: 0.91,
  clinical: 0.62,
  preprints: 0.55,
};
