import type { LearnedPreference, PreferenceWeights, TopicProfile } from "@/lib/types";

/**
 * A worked example topic, offered when creating one so a researcher can see
 * what a complete topic looks like before writing their own.
 */
export const EXAMPLE_PROFILE: TopicProfile = {
  program: "KRAS G12D in non-small cell lung cancer",
  description:
    "We study acquired resistance to KRAS G12D-selective inhibitors in non-small-cell lung cancer: which resistance mechanisms emerge, which combination therapies extend durability, and what the clinical trial landscape for G12D inhibitors looks like. We use patient-derived models and longitudinal ctDNA.",
  keywords: [
    "KRAS G12D",
    "G12D inhibitor",
    "acquired resistance",
    "RAS/MAPK signaling",
    "combination therapy",
  ],
  synonyms: ["KRAS p.G12D", "MRTX1133", "zoldonrasib", "pan-RAS inhibitor", "RAS(ON) inhibitor"],
  organisms: [],
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
  exclusions: [],
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
