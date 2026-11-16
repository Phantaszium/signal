import type {
  LearnedPreference,
  PreferenceWeights,
  ResearchProfile,
} from "@/lib/types";

/**
 * A worked example profile, offered during onboarding so a new researcher can
 * see what a complete profile looks like before writing their own.
 */
export const EXAMPLE_PROFILE: ResearchProfile = {
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
 * The "what Signal has learned" statements. Each maps to a preference key that
 * the scoring module reads, so these are not decorative: the confidence shown
 * is the live weight, and it moves as the researcher gives feedback.
 */
export const LEARNED_PREFERENCES: Omit<LearnedPreference, "confidence">[] = [
  {
    id: "pref-mechanistic",
    statement: "You prioritize mechanistic studies over purely descriptive ones.",
    key: "mechanistic",
  },
  {
    id: "pref-invitro",
    statement: "You discount in-vitro-only claims.",
    key: "discountInVitroOnly",
  },
  {
    id: "pref-negative",
    statement: "You value well-powered negative results.",
    key: "negativeResults",
  },
  {
    id: "pref-resistance",
    statement: "You read studies on treatment resistance.",
    key: "acquiredResistance",
  },
  {
    id: "pref-clinical",
    statement: "You favour work with clinical or patient data.",
    key: "clinical",
  },
  {
    id: "pref-preprints",
    statement: "You read preprints.",
    key: "preprints",
  },
];

/** Every account starts neutral; feedback moves the weights from here. */
export const NEUTRAL_PREFERENCE_WEIGHTS: PreferenceWeights = {
  mechanistic: 0.5,
  discountInVitroOnly: 0.5,
  negativeResults: 0.5,
  acquiredResistance: 0.5,
  clinical: 0.5,
  preprints: 0.5,
};
