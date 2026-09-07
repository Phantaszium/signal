import type { Publication } from "@/lib/types";

/**
 * DEMO CORPUS — every item below is FICTIONAL.
 *
 * Authors, findings, drug codenames, DOIs and trial identifiers are invented.
 * Venue names (bioRxiv, Nature Cancer, ...) are used only as realistic
 * containers; no claim here should be attributed to any real publication,
 * author, or company. The UI marks every seed item with a "Demo" chip and the
 * detail page repeats the disclaimer.
 *
 * The corpus deliberately contains off-topic items so the relevance filter has
 * real work to do rather than passing everything through.
 */
export const SEED_PUBLICATIONS: Publication[] = [
  // ------------------------------------------------------------------ HIGH
  {
    id: "sig-001",
    implication:
      "the authors identify a bypass mechanism that re-engages RAS-GTP loading within 72 hours, which would shorten the durability you can expect from single-agent inhibition and argues for co-targeting SOS1 rather than SHP2",
    title:
      "SHP2-independent SOS1 reactivation drives adaptive escape from KRAS G12D-selective inhibition in lung adenocarcinoma",
    source: "Nature Cancer",
    publishedAt: "2026-09-05",
    type: "journal",
    authors: [
      "L. Marchetti",
      "D. Okonkwo",
      "S. Ravindran",
      "P. Halloran",
      "J. Wei",
    ],
    summary:
      "A bypass loop in which SOS1 is re-engaged independently of SHP2 restores RAS-GTP loading within 72 hours of KRAS G12D inhibition, blunting durability of response.",
    abstract:
      "KRAS G12D-selective inhibitors produce rapid tumour regression in lung adenocarcinoma but responses are frequently short-lived. Using longitudinal phosphoproteomics across 14 patient-derived models, we identify an adaptive program in which SOS1 nucleotide exchange activity is restored independently of SHP2 scaffolding. Reactivation is detectable at 72 hours, precedes measurable proliferative rebound by approximately nine days, and is not abrogated by SHP2 inhibition. Combined KRAS G12D and SOS1 blockade suppressed RAS-GTP re-loading and extended progression-free interval in xenograft cohorts. These data nominate SOS1 as a co-target whose value is independent of the SHP2 axis, and suggest that SHP2 combination strategies may under-address the earliest resistance mechanism.",
    tags: ["KRAS G12D", "SOS1", "acquired resistance", "RAS/MAPK", "NSCLC"],
    organizations: ["Dana-Farber (fictional lab)", "Revolution Medicines"],
    origin: "seed",
    doi: "10.0000/demo.natcan.2026.0915",
    keyFindings: [
      "SOS1 exchange activity recovers within 72 h of KRAS G12D inhibition across 12 of 14 patient-derived models.",
      "Reactivation occurs without detectable SHP2 phosphorylation and is unaffected by allosteric SHP2 inhibition.",
      "RAS-GTP re-loading precedes proliferative rebound by a median of 9 days, defining an intervention window.",
      "Dual KRAS G12D + SOS1 blockade extended time to progression from 24 to 61 days in xenograft cohorts.",
    ],
    studyDesign:
      "Longitudinal phosphoproteomic and RAS-GTP profiling across a 14-model patient-derived panel, with in-vivo validation in matched xenograft cohorts (n = 8 per arm).",
    modelSystem:
      "Patient-derived organoids and xenografts from KRAS G12D-mutant lung adenocarcinoma; no patient dosing data.",
    limitations: [
      "No clinical cohort; all durability estimates are preclinical.",
      "Xenograft arms were not powered for survival, only time-to-progression.",
      "SOS1 inhibitor tool compound has known off-target activity at high exposure.",
    ],
    authorsReport: [
      "SOS1 exchange activity is restored independently of SHP2 following KRAS G12D inhibition.",
      "Dual KRAS G12D + SOS1 blockade extended time to progression in xenografts.",
      "The authors describe the 9-day interval as a 'candidate intervention window'.",
    ],
    signalInterpretation: [
      "If this holds clinically, SHP2-based combination strategies may be addressing a later node than the one that initiates escape — relevant to how you sequence your own combination arms.",
      "The 72-hour timing is short enough that early on-treatment biopsy or ctDNA sampling in your protocol would likely capture it.",
    ],
    signals: {
      mechanistic: true,
      inVitroOnly: false,
      clinical: false,
      acquiredResistance: true,
      noveltyPrior: 88,
      strategicPrior: 82,
      replication: "internal",
      cohortSize: 14,
    },
  },
  {
    id: "sig-002",
    implication:
      "it puts a number and a lead time on the resistance route your ctDNA protocol is designed to catch — MET amplification at 31%, detectable roughly seven weeks before imaging shows progression",
    title:
      "Longitudinal ctDNA reveals convergent MET amplification as the dominant resistance route to KRAS G12D inhibition across two trial cohorts",
    source: "Journal of Thoracic Oncology",
    publishedAt: "2026-09-04",
    type: "journal",
    authors: ["A. Bergström", "M. Ferreira", "K. Nakamura", "R. Teale"],
    summary:
      "In 118 patients with serial ctDNA, MET amplification emerged in 31% at progression — more than double the frequency of secondary KRAS alterations.",
    abstract:
      "We analysed serial circulating tumour DNA from 118 patients with KRAS G12D-mutant NSCLC treated with a G12D-selective inhibitor across two prospective cohorts. At radiographic progression, MET amplification was detected in 37 of 118 patients (31%), secondary KRAS alterations in 17 (14%), and NF1 loss-of-function events in 9 (8%). MET amplification was detectable a median of 7.4 weeks before radiographic progression. Patients with pre-treatment MET copy gain had shorter progression-free survival. The convergence of an off-pathway amplification as the leading escape route, rather than on-target mutation, differs from the pattern established for G12C-selective agents.",
    tags: ["KRAS G12D", "ctDNA", "MET", "acquired resistance", "NSCLC"],
    organizations: ["Multi-centre consortium (fictional)"],
    origin: "seed",
    doi: "10.0000/demo.jto.2026.0904",
    keyFindings: [
      "MET amplification at progression in 31% of patients (37/118) — the single most common resistance event.",
      "Secondary KRAS alterations in only 14%, a lower on-target rate than reported for G12C-selective agents.",
      "MET signal detectable a median of 7.4 weeks before radiographic progression.",
      "Pre-treatment MET copy gain associated with shorter PFS (HR 1.9, 95% CI 1.2–3.0).",
    ],
    studyDesign:
      "Retrospective analysis of prospectively collected serial ctDNA from two multi-centre cohorts; 118 patients, median 5 timepoints each.",
    modelSystem: "Human patient plasma ctDNA; no tissue confirmation in 44% of cases.",
    limitations: [
      "Tissue confirmation of MET amplification was available in only 56% of cases.",
      "Two cohorts used different ctDNA panels, with harmonisation applied post hoc.",
      "No functional demonstration that MET amplification is causal rather than co-selected.",
    ],
    authorsReport: [
      "MET amplification was the most frequent event at progression across both cohorts.",
      "MET signal preceded radiographic progression by a median of 7.4 weeks.",
      "The authors note the on-target mutation rate is lower than published G12C series.",
    ],
    signalInterpretation: [
      "This is association, not causation — the paper does not demonstrate that MET amplification is sufficient for resistance.",
      "The 7.4-week lead time is the operationally useful number for your ctDNA protocol; it suggests a monitoring interval shorter than your current 12-week schedule would change management.",
    ],
    signals: {
      mechanistic: false,
      inVitroOnly: false,
      clinical: true,
      acquiredResistance: true,
      noveltyPrior: 79,
      strategicPrior: 76,
      replication: "independent",
      cohortSize: 118,
    },
  },
  {
    id: "sig-003",
    implication:
      "it is the clinical readout for the exact combination hypothesis your mechanistic work points to, from two organisations on your watchlist",
    title:
      "Phase 1b combination of a KRAS G12D inhibitor with a SOS1 inhibitor: dose expansion results (Trial DEMO-NCT00000000)",
    source: "Trial registry update (demo)",
    publishedAt: "2026-09-03",
    type: "trial",
    authors: ["Sponsor-reported (fictional record)"],
    summary:
      "A fictional dose-expansion record reporting 44% confirmed response rate in previously treated KRAS G12D NSCLC, with dose-limiting GI toxicity at the top dose level.",
    abstract:
      "Fictional registry record created for demonstration. Dose expansion of a KRAS G12D-selective inhibitor combined with an oral SOS1 inhibitor in patients with non-small-cell lung cancer (NSCLC) who progressed on prior targeted therapy, i.e. in the acquired resistance setting. Confirmed objective response rate 44% (22/50); median duration of response not reached at 7.2 months follow-up. Grade 3+ diarrhoea in 18% at the highest dose level led to selection of a lower expansion dose. Paired biopsies at cycle 1 day 15 showed reduced pERK relative to single-agent historical controls.",
    tags: ["KRAS G12D", "SOS1", "combination therapy", "clinical trial", "NSCLC"],
    organizations: ["Revolution Medicines", "Mirati/BMS"],
    origin: "seed",
    keyFindings: [
      "Confirmed ORR 44% (22/50) in previously treated KRAS G12D-mutant NSCLC.",
      "Median duration of response not reached at 7.2 months median follow-up.",
      "Grade 3+ diarrhoea in 18% at the top dose; expansion dose reduced accordingly.",
      "Paired on-treatment biopsies showed deeper pERK suppression than single-agent historical controls.",
    ],
    studyDesign:
      "Open-label phase 1b dose expansion, single arm, n = 50, with paired pre/on-treatment biopsies in 31 patients.",
    modelSystem: "Human, previously treated KRAS G12D-mutant NSCLC.",
    limitations: [
      "Single-arm, non-randomised; comparison to single-agent uses historical controls.",
      "Duration of response immature at data cut.",
      "Tolerability at the selected dose is not yet established in a larger population.",
    ],
    authorsReport: [
      "Sponsor reports 44% confirmed ORR and manageable toxicity at the reduced expansion dose.",
      "Sponsor reports deeper pERK suppression than single-agent historical controls.",
    ],
    signalInterpretation: [
      "The pERK depth claim rests on historical rather than randomised comparison; treat it as directional.",
      "This is the clinical counterpart to the SOS1 bypass mechanism in the Nature Cancer item above — the two together are the strongest argument this week that SOS1 co-targeting is the leading combination hypothesis in your space.",
    ],
    signals: {
      mechanistic: false,
      inVitroOnly: false,
      clinical: true,
      acquiredResistance: true,
      noveltyPrior: 74,
      strategicPrior: 94,
      replication: "none",
      cohortSize: 50,
    },
  },

  // --------------------------------------------------------------- NOTABLE
  {
    id: "sig-004",
    implication:
      "whether persisters are selected or induced determines whether intermittent dosing could help you, though the evidence here is in-vitro only",
    title:
      "Single-cell profiling identifies a pre-existing drug-tolerant persister state in KRAS-mutant lung adenocarcinoma",
    source: "bioRxiv",
    publishedAt: "2026-09-02",
    type: "preprint",
    authors: ["H. Lindqvist", "T. Abara", "C. Moreau"],
    summary:
      "A transcriptionally distinct persister population is present before treatment and expands under KRAS inhibition rather than arising de novo.",
    abstract:
      "Fictional preprint. Single-cell RNA-seq across 9 KRAS-mutant lung adenocarcinoma models identifies a persister-like state defined by an AP-1-high, RAS-output-low program. The state is detectable at 0.3–1.7% frequency before treatment and expands 12-fold under KRAS inhibition. Lineage barcoding indicates expansion of pre-existing cells rather than de novo reprogramming in 7 of 9 models. The program is partially reversible on drug holiday.",
    tags: ["tumor evolution", "persister cells", "single-cell RNA-seq", "KRAS"],
    organizations: ["Academic consortium (fictional)"],
    origin: "seed",
    keyFindings: [
      "An AP-1-high, RAS-output-low persister state exists at 0.3–1.7% before treatment.",
      "The state expands ~12-fold under KRAS inhibition.",
      "Lineage barcoding supports selection of pre-existing cells over de novo reprogramming in 7/9 models.",
      "The program is partially reversible during drug holiday.",
    ],
    studyDesign: "Single-cell RNA-seq plus lineage barcoding across 9 cell-line and organoid models.",
    modelSystem: "Cell lines and organoids only; no in-vivo or patient validation.",
    limitations: [
      "In-vitro only — no xenograft or patient confirmation.",
      "Preprint, not yet peer reviewed.",
      "Barcode complexity may under-detect rare de novo events.",
    ],
    authorsReport: [
      "A pre-existing persister state expands under KRAS inhibition.",
      "Lineage tracing favours selection over reprogramming in most models.",
    ],
    signalInterpretation: [
      "The selection-vs-reprogramming distinction matters for whether intermittent dosing helps you; the authors do not test dosing schedules.",
      "Scored down on evidence strength because it is in-vitro-only, consistent with your stated preference.",
    ],
    signals: {
      mechanistic: true,
      inVitroOnly: true,
      clinical: false,
      acquiredResistance: true,
      noveltyPrior: 71,
      strategicPrior: 45,
      replication: "none",
      cohortSize: 9,
    },
  },
  {
    id: "sig-005",
    implication:
      "an adequately powered negative closes off vertical MEK combination at these exposures, which removes a design option from your combination roadmap",
    title:
      "Well-powered negative result: adding a MEK inhibitor to KRAS G12D blockade does not extend progression-free survival",
    source: "Annals of Oncology",
    publishedAt: "2026-09-01",
    type: "journal",
    authors: ["R. Vasquez", "N. Adeyemi", "F. Rossi", "G. Chandra"],
    summary:
      "A randomised phase 2 with 240 patients found no PFS benefit from adding MEK inhibition, with substantially increased toxicity.",
    abstract:
      "Fictional randomised phase 2. 240 patients with KRAS G12D-mutant NSCLC were randomised to a G12D-selective inhibitor with or without a MEK inhibitor. Median PFS was 6.1 vs 6.4 months (HR 1.04, 95% CI 0.79–1.37); the study had 85% power to detect an HR of 0.65. Grade 3+ adverse events occurred in 51% vs 24%. Vertical pathway inhibition at these exposures did not improve outcomes.",
    tags: ["KRAS G12D", "MEK", "negative result", "randomised trial", "RAS/MAPK"],
    organizations: ["Eli Lilly"],
    origin: "seed",
    keyFindings: [
      "No PFS difference: 6.1 vs 6.4 months (HR 1.04, 95% CI 0.79–1.37).",
      "Study was powered at 85% to detect HR 0.65 — a genuinely informative negative.",
      "Grade 3+ adverse events more than doubled (51% vs 24%).",
      "No subgroup showed benefit, including MAPK-high tumours.",
    ],
    studyDesign: "Randomised, open-label phase 2, 1:1, n = 240, PFS primary endpoint.",
    modelSystem: "Human, KRAS G12D-mutant NSCLC, previously treated.",
    limitations: [
      "MEK inhibitor dosed intermittently; continuous dosing untested.",
      "Open-label design may affect investigator-assessed progression.",
      "Exposures at the tolerated dose may be below the level required for vertical suppression.",
    ],
    authorsReport: [
      "Adding MEK inhibition did not improve PFS at the doses tested.",
      "Toxicity was substantially higher in the combination arm.",
    ],
    signalInterpretation: [
      "The negative is about these exposures and this schedule, not about vertical inhibition in principle — the authors say so explicitly.",
      "Ranked highly on evidence strength because it is adequately powered; you have told Signal you value negative results that are actually informative.",
    ],
    signals: {
      mechanistic: false,
      inVitroOnly: false,
      clinical: true,
      negativeResult: true,
      acquiredResistance: false,
      noveltyPrior: 52,
      strategicPrior: 70,
      replication: "none",
      cohortSize: 240,
    },
  },
  {
    id: "sig-006",
    implication:
      "the SOS1-reverses / SHP2-does-not pattern independently corroborates this week's lead finding using a completely different approach",
    title:
      "NF1 loss confers cross-resistance to both KRAS G12C- and G12D-selective inhibitors in isogenic models",
    source: "Cancer Research",
    publishedAt: "2026-08-31",
    type: "journal",
    authors: ["Y. Sun", "E. Whitlock", "M. Baptiste"],
    summary:
      "CRISPR knockout of NF1 produced 8–14-fold resistance shifts to both G12C- and G12D-selective agents across isogenic lines.",
    abstract:
      "Fictional study. Isogenic CRISPR knockout of NF1 in KRAS G12C- and G12D-mutant backgrounds produced 8–14-fold increases in IC50 to allele-selective inhibitors, accompanied by sustained RAS-GTP loading. Resistance was partially reversed by SOS1 inhibition but not by SHP2 inhibition. NF1-null cells retained sensitivity to pan-RAS(ON) inhibition in vitro.",
    tags: ["NF1", "cross-resistance", "CRISPR", "RAS/MAPK", "KRAS G12D"],
    organizations: ["Academic (fictional)"],
    origin: "seed",
    keyFindings: [
      "NF1 knockout shifts IC50 8–14-fold for both G12C- and G12D-selective inhibitors.",
      "Resistance is partially reversed by SOS1 but not SHP2 inhibition.",
      "NF1-null cells remain sensitive to pan-RAS(ON) inhibition in vitro.",
    ],
    studyDesign: "Isogenic CRISPR knockout panel, dose-response and RAS-GTP assays.",
    modelSystem: "Engineered cell lines only.",
    limitations: [
      "Isogenic knockouts may not reflect the partial NF1 loss seen in patients.",
      "In-vitro only.",
      "Pan-RAS(ON) sensitivity was not tested in vivo.",
    ],
    authorsReport: [
      "NF1 loss confers cross-resistance to allele-selective KRAS inhibitors.",
      "SOS1 but not SHP2 inhibition partially restores sensitivity.",
    ],
    signalInterpretation: [
      "The SOS1-yes / SHP2-no pattern here independently echoes the Nature Cancer finding at the top of your briefing, from a completely different experimental approach.",
      "Complete knockout is a strong perturbation; patient NF1 events are often partial, so effect sizes are likely an upper bound.",
    ],
    signals: {
      mechanistic: true,
      inVitroOnly: true,
      clinical: false,
      acquiredResistance: true,
      noveltyPrior: 64,
      strategicPrior: 48,
      replication: "internal",
      cohortSize: 6,
    },
  },
  {
    id: "sig-007",
    implication:
      "it raises the evidentiary bar for the accelerated-approval path your collaborators' trials are designed around, and touches all four organisations you track",
    title:
      "Regulatory update: accelerated approval pathway guidance revised for allele-selective RAS inhibitors (demo record)",
    source: "Regulatory brief (demo)",
    publishedAt: "2026-08-30",
    type: "regulatory",
    authors: ["Agency record (fictional)"],
    summary:
      "A fictional guidance revision would require randomised confirmatory data for accelerated approval of RAS-targeted agents in previously treated NSCLC.",
    abstract:
      "Fictional regulatory record for demonstration. Draft guidance revision indicates that single-arm response-rate data would no longer be sufficient for accelerated approval of allele-selective RAS inhibitors, including KRAS G12D-selective targeted therapy, in previously treated non-small-cell lung cancer (NSCLC), with randomised confirmatory evidence expected at time of filing. A 90-day comment period is described.",
    tags: ["regulatory", "accelerated approval", "RAS", "NSCLC"],
    organizations: ["Revolution Medicines", "Mirati/BMS", "Eli Lilly", "Genentech/Roche"],
    origin: "seed",
    keyFindings: [
      "Single-arm ORR data would no longer suffice for accelerated approval in this setting.",
      "Randomised confirmatory evidence expected at filing rather than post-approval.",
      "90-day comment period described before adoption.",
    ],
    studyDesign: "Not applicable — regulatory guidance record.",
    modelSystem: "Not applicable.",
    limitations: [
      "Draft guidance; not final and subject to comment.",
      "Scope of 'previously treated' is not precisely defined in the draft.",
    ],
    authorsReport: [
      "The draft describes a higher evidentiary bar for accelerated approval in this setting.",
    ],
    signalInterpretation: [
      "This changes the value of randomised arms in the combination trials your collaborators are designing — a design decision, not a science one.",
      "All four of your tracked organisations have programs that would fall in scope.",
    ],
    signals: {
      mechanistic: false,
      inVitroOnly: false,
      clinical: false,
      acquiredResistance: false,
      noveltyPrior: 58,
      strategicPrior: 88,
      replication: "none",
    },
  },
  {
    id: "sig-008",
    implication:
      "if the HGF axis is real it converges with the MET amplification signal in your briefing, suggesting a stromal contribution to the resistance you study",
    title:
      "Spatial transcriptomics maps stromal MAPK reactivation at the invasive margin after KRAS inhibition",
    source: "bioRxiv",
    publishedAt: "2026-08-29",
    type: "preprint",
    authors: ["I. Kowalski", "B. Nnamdi", "S. Petrov"],
    summary:
      "Residual MAPK output after KRAS inhibition localises to the invasive margin and correlates with fibroblast density.",
    abstract:
      "Fictional preprint. Spatial transcriptomics across 22 resected KRAS-mutant lung adenocarcinoma specimens with on-treatment sampling shows that residual MAPK transcriptional output is spatially concentrated at the invasive margin and correlates with CAF density (r = 0.61). Ligand-receptor inference nominates FGF and HGF axes as candidate stromal inputs.",
    tags: ["tumor microenvironment", "RAS/MAPK", "spatial transcriptomics", "NSCLC"],
    organizations: ["Genentech/Roche"],
    origin: "seed",
    keyFindings: [
      "Residual MAPK output is spatially concentrated at the invasive margin.",
      "MAPK output correlates with CAF density (r = 0.61) across 22 specimens.",
      "Ligand-receptor inference nominates FGF and HGF as candidate stromal inputs.",
    ],
    studyDesign: "Spatial transcriptomics on 22 human resection specimens, 9 with on-treatment sampling.",
    modelSystem: "Human tissue; inference-based ligand-receptor analysis, not functional.",
    limitations: [
      "Ligand-receptor pairs are computationally inferred, not experimentally validated.",
      "Only 9 specimens had on-treatment sampling.",
      "Preprint; not peer reviewed.",
    ],
    authorsReport: [
      "Residual MAPK output localises to the invasive margin and tracks with CAF density.",
      "FGF and HGF axes are nominated computationally as stromal inputs.",
    ],
    signalInterpretation: [
      "Correlation with CAF density does not establish that stroma drives the residual signal; the reverse is equally consistent with the data shown.",
      "If the HGF axis is real, it converges with the MET amplification finding in your HIGH section — worth holding as a hypothesis, not a conclusion.",
    ],
    signals: {
      mechanistic: true,
      inVitroOnly: false,
      clinical: false,
      acquiredResistance: true,
      noveltyPrior: 66,
      strategicPrior: 52,
      replication: "none",
      cohortSize: 22,
    },
  },

  // --------------------------------------------------------------- CONTEXT
  {
    id: "sig-009",
    implication:
      "background on the first-line setting your patients pass through before reaching targeted therapy, not a direct input to your resistance work",
    title:
      "Real-world outcomes of first-line chemo-immunotherapy in KRAS-mutant NSCLC: a 2,400-patient registry analysis",
    source: "Lung Cancer",
    publishedAt: "2026-08-28",
    type: "journal",
    authors: ["P. Delacroix", "V. Anand", "L. Björk"],
    summary:
      "Registry data show KRAS mutation subtype had limited association with first-line chemo-immunotherapy outcomes after adjustment for STK11 status.",
    abstract:
      "Fictional registry analysis of 2,400 patients with non-small-cell lung cancer. After adjustment for STK11/KEAP1 co-mutation, KRAS allele subtype was not independently associated with overall survival on first-line chemo-immunotherapy (adjusted HR 1.05, 95% CI 0.91–1.21).",
    tags: ["NSCLC", "immunotherapy", "real-world evidence", "KRAS"],
    organizations: ["Registry consortium (fictional)"],
    origin: "seed",
    keyFindings: [
      "KRAS allele subtype not independently associated with OS after adjusting for STK11/KEAP1.",
      "STK11 co-mutation remained the dominant prognostic variable.",
    ],
    studyDesign: "Retrospective registry cohort, n = 2,400, multivariable adjustment.",
    modelSystem: "Human, real-world first-line setting.",
    limitations: [
      "Retrospective with unmeasured confounding.",
      "Sequencing panels varied across contributing sites.",
    ],
    authorsReport: [
      "KRAS subtype showed no independent association with survival after adjustment.",
    ],
    signalInterpretation: [
      "Background context for your program rather than a direct input — it concerns the first-line immunotherapy setting, not targeted resistance.",
    ],
    signals: {
      mechanistic: false,
      inVitroOnly: false,
      clinical: true,
      acquiredResistance: false,
      noveltyPrior: 31,
      strategicPrior: 34,
      replication: "none",
      cohortSize: 2400,
    },
  },
  {
    id: "sig-010",
    implication:
      "useful only as background when interpreting differential potency across G12 alleles",
    title:
      "A structural account of allele-selective binding across KRAS G12 variants",
    source: "Journal of Medicinal Chemistry",
    publishedAt: "2026-08-27",
    type: "journal",
    authors: ["Q. Oyelaran", "T. Iverson"],
    summary:
      "Co-crystal structures rationalise why switch-II pocket binders differ in selectivity across G12C, G12D and G12V.",
    abstract:
      "Fictional structural study. Co-crystal structures of six switch-II pocket ligands across G12C, G12D and G12V rationalise selectivity differences and identify a conserved water-mediated contact that distinguishes KRAS G12D engagement, informing the design of allele-selective targeted therapy.",
    tags: ["structural biology", "KRAS", "medicinal chemistry"],
    organizations: ["Academic (fictional)"],
    origin: "seed",
    keyFindings: [
      "A conserved water-mediated contact distinguishes G12D engagement from G12C.",
      "Selectivity across six ligands is explained by switch-II pocket geometry.",
    ],
    studyDesign: "X-ray co-crystallography with biochemical binding assays.",
    modelSystem: "Purified protein; no cellular or animal work.",
    limitations: ["Purely biophysical; no cellular potency correlation shown."],
    authorsReport: ["Structural basis for allele selectivity across G12 variants."],
    signalInterpretation: [
      "Useful background if you are interpreting differential potency data, but no direct bearing on resistance mechanisms.",
    ],
    signals: {
      mechanistic: true,
      inVitroOnly: true,
      clinical: false,
      acquiredResistance: false,
      noveltyPrior: 44,
      strategicPrior: 25,
      replication: "none",
    },
  },
  {
    id: "sig-011",
    implication:
      "the tissue-specific divergence in escape routes bears on how far your lung findings generalise",
    title:
      "KRAS G12D inhibition in pancreatic ductal adenocarcinoma: early signals from an expansion cohort",
    source: "bioRxiv",
    publishedAt: "2026-08-26",
    type: "preprint",
    authors: ["C. Ibarra", "D. Fenwick", "A. Sultana"],
    summary:
      "A small PDAC expansion cohort reports a 21% response rate, with resistance patterns that differ from those seen in lung.",
    abstract:
      "Fictional preprint. In a 34-patient PDAC expansion cohort treated with a KRAS G12D-selective inhibitor, confirmed ORR was 21%. At progression, MYC amplification rather than MET amplification predominated, suggesting tissue-specific escape routes.",
    tags: ["KRAS G12D", "pancreatic cancer", "acquired resistance"],
    organizations: ["Academic (fictional)"],
    origin: "seed",
    keyFindings: [
      "Confirmed ORR 21% in a 34-patient PDAC expansion cohort.",
      "MYC amplification predominated at progression, unlike the MET pattern reported in lung.",
    ],
    studyDesign: "Single-arm expansion cohort, n = 34, with progression biopsies in 19.",
    modelSystem: "Human PDAC.",
    limitations: [
      "Small cohort; progression biopsies in only 19 patients.",
      "Preprint, not peer reviewed.",
    ],
    authorsReport: [
      "Response rate of 21% and a MYC-dominant resistance pattern in PDAC.",
    ],
    signalInterpretation: [
      "Adjacent disease, not your primary setting — included because tissue-specific divergence in escape routes is directly informative about how generalisable your lung findings are.",
    ],
    signals: {
      mechanistic: false,
      inVitroOnly: false,
      clinical: true,
      acquiredResistance: true,
      noveltyPrior: 55,
      strategicPrior: 40,
      replication: "none",
      cohortSize: 34,
    },
  },

  // ------------------------------------------- Below threshold (filtered out)
  {
    id: "sig-012",
    title: "Gut microbiome composition and response to checkpoint blockade in melanoma",
    source: "Gut Microbes",
    publishedAt: "2026-09-04",
    type: "journal",
    authors: ["S. Aguilar", "M. Ozturk"],
    summary: "Fictional study associating microbial diversity with checkpoint inhibitor response in melanoma.",
    abstract: "Fictional study. Faecal microbial diversity was associated with response to checkpoint blockade in a 190-patient melanoma cohort.",
    tags: ["microbiome", "melanoma", "immunotherapy"],
    organizations: [],
    origin: "seed",
    signals: { noveltyPrior: 40, strategicPrior: 10 },
  },
  {
    id: "sig-013",
    title: "Deep learning segmentation of cardiac MRI improves ejection fraction reproducibility",
    source: "Radiology: AI",
    publishedAt: "2026-09-03",
    type: "journal",
    authors: ["J. Park", "L. Mensah"],
    summary: "Fictional imaging study on automated cardiac MRI segmentation.",
    abstract: "Fictional study. An automated segmentation model reduced inter-reader variability in ejection fraction measurement.",
    tags: ["imaging", "machine learning", "cardiology"],
    organizations: [],
    origin: "seed",
    signals: { noveltyPrior: 35, strategicPrior: 5 },
  },
  {
    id: "sig-014",
    title: "CRISPR base editing corrects a hepatic urea cycle defect in neonatal mice",
    source: "Molecular Therapy",
    publishedAt: "2026-09-02",
    type: "journal",
    authors: ["R. Castellanos", "H. Yamada"],
    summary: "Fictional gene-editing study in a metabolic disease model.",
    abstract: "Fictional study. Base editing restored urea cycle enzyme activity in a neonatal mouse model.",
    tags: ["gene editing", "metabolic disease", "CRISPR"],
    organizations: [],
    origin: "seed",
    signals: { noveltyPrior: 62, strategicPrior: 8 },
  },
  {
    id: "sig-015",
    title: "Tau propagation kinetics in a primate model of Alzheimer's disease",
    source: "Neuron",
    publishedAt: "2026-09-01",
    type: "journal",
    authors: ["G. Almeida", "P. Nwosu"],
    summary: "Fictional neurodegeneration study on tau spreading kinetics.",
    abstract: "Fictional study. Tau propagation followed connectivity-weighted kinetics in a primate model.",
    tags: ["neuroscience", "tau", "Alzheimer's"],
    organizations: [],
    origin: "seed",
    signals: { noveltyPrior: 58, strategicPrior: 5 },
  },
  {
    id: "sig-016",
    title: "Antibiotic stewardship intervention reduces broad-spectrum use in community hospitals",
    source: "JAMA Network Open",
    publishedAt: "2026-08-31",
    type: "journal",
    authors: ["K. Duval", "O. Adesanya"],
    summary: "Fictional health-services study on antibiotic prescribing.",
    abstract: "Fictional study. A stewardship intervention reduced broad-spectrum antibiotic days of therapy by 18%.",
    tags: ["infectious disease", "health services"],
    organizations: [],
    origin: "seed",
    signals: { noveltyPrior: 25, strategicPrior: 4 },
  },
  {
    id: "sig-017",
    title: "Cryo-EM structure of a bacterial efflux pump in the substrate-bound state",
    source: "Nature Structural & Molecular Biology",
    publishedAt: "2026-08-30",
    type: "journal",
    authors: ["Z. Haddad", "E. Lindberg"],
    summary: "Fictional structural microbiology study.",
    abstract: "Fictional study. Cryo-EM structures reveal substrate engagement in a bacterial multidrug efflux pump.",
    tags: ["structural biology", "microbiology"],
    organizations: [],
    origin: "seed",
    signals: { noveltyPrior: 55, strategicPrior: 3 },
  },
];
