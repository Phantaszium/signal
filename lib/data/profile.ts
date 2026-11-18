import type { LearnedPreference, PreferenceWeights, TopicProfile } from "@/lib/types";

/**
 * A worked example topic, offered when creating one so a researcher can see
 * what a complete topic looks like before writing their own.
 */
export const EXAMPLE_PROFILE: TopicProfile = {
  program: "Gut microbiota and resistance to C. difficile colonization",
  description:
    "I'm an undergraduate in a microbiology lab studying how commensal gut bacteria protect mice from Clostridioides difficile colonization after antibiotics. We culture anaerobes, run 16S rRNA sequencing on stool samples, and are interested in bile acid metabolism and competition for nutrients.",
  keywords: [
    "colonization resistance",
    "Clostridioides difficile",
    "gut microbiota",
    "secondary bile acids",
    "antibiotic-induced dysbiosis",
  ],
  synonyms: ["Clostridium difficile", "C. difficile infection", "CDI"],
  organisms: ["Clostridioides difficile", "Clostridium scindens"],
  genes: ["baiCD", "tcdA", "tcdB"],
  diseases: ["Clostridioides difficile infection"],
  techniques: ["16S rRNA sequencing", "anaerobic culture", "gnotobiotic mice", "metabolomics"],
  organizations: [],
  exclusions: [],
};

/**
 * The "what PaperPuffin has learned" statements. Each maps to a preference key that
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
    statement: "You read studies on resistance (antibiotic, drug or treatment).",
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
