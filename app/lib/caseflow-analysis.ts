export const FICTIONAL_DATA_NOTICE =
  "Demonstration environment — fictional case data only.";

export const REPORT_WARNING =
  "AI-assisted observations may contain errors. All findings require verification by an authorised officer and do not determine guilt, innocence, arrest, bail, or sentencing.";

export const ADVISORY_OUTPUT_LABEL =
  "AI-assisted advisory output — fictional demonstration data only.";

export const CASE_DRAFT_STORAGE_PREFIX = "caseflow:fictional-case:";
export const CASE_REPORT_STORAGE_PREFIX = "caseflow:analysis-report:";
export const CASE_CHAT_STORAGE_PREFIX = "caseflow:case-chat:";

export const CASE_ASSISTANT_PERSISTENT_NOTE =
  "AI-assisted responses may contain errors. Verify all observations against the case record before taking action.";

export const CASE_ASSISTANT_UNAVAILABLE_MESSAGE =
  "The case assistant is temporarily unavailable. Your conversation has been preserved.";

export const casePreparationStatuses = [
  "Ready for review",
  "Needs clarification",
  "Missing critical information",
  "Awaiting forensic material",
  "Information incomplete",
] as const;

export type CasePreparationStatus = (typeof casePreparationStatuses)[number];

export type CaseIdentification = {
  district: string;
  policeStation: string;
  fictionalCaseNumber: string;
  year: string;
  actsAndSections: string;
  caseCategory: string;
};

export type OccurrenceDetails = {
  occurrenceDate: string;
  occurrenceTime: string;
  place: string;
  address: string;
  distanceDirectionFromPoliceStation: string;
  informationReceivedDateTime: string;
  generalDiaryReference: string;
};

export type CaseNarrative = {
  incidentSummary: string;
  detailedCaseContents: string;
  delayReason?: string;
};

export type WitnessStatementInput = {
  id: string;
  label: string;
  statement: string;
  mentionedDateTime: string;
  mentionedLocation: string;
  sourceNotes: string;
};

export type PeopleDetails = {
  complainantInformantSummary: string;
  personDetails: string;
  witnesses: WitnessStatementInput[];
};

export type ElectronicEvidenceRecord = {
  id: string;
  sourceDeviceType: string;
  makeModel: string;
  exhibitSerialNumber: string;
  collectionDateTime: string;
  hashAlgorithm: string;
  hashValue: string;
  chainOfCustodyStatus: string;
};

export type EvidenceDetails = {
  physicalEvidence: string;
  digitalEvidence: string;
  propertyInvolved: string;
  investigationUpdates: string;
  chainOfCustodyNotes: string;
  forensicRequestDetails: string;
  electronicEvidenceRecords: ElectronicEvidenceRecord[];
};

export type FictionalCaseInput = {
  caseId: string;
  caseIdentification: CaseIdentification;
  occurrenceDetails: OccurrenceDetails;
  caseNarrative: CaseNarrative;
  people: PeopleDetails;
  evidence: EvidenceDetails;
  createdAt: string;
};

export type TimelineItem = {
  stage: string;
  observation: string;
  source: string;
};

export type ContradictionItem = {
  topic: string;
  accountA: string;
  accountB: string;
  observation: string;
};

export type EvidenceGap = {
  item: string;
  reason: string;
};

export type ForensicRequestReview = {
  item: string;
  status: string;
  note: string;
};

export type RecommendedReviewPoint = {
  reviewPoint: string;
  rationale: string;
};

export type CaseIntelligenceReport = {
  neutralSummary: string;
  timeline: TimelineItem[];
  contradictions: ContradictionItem[];
  missingInformation: string[];
  evidenceGaps: EvidenceGap[];
  forensicRequestReview: ForensicRequestReview[];
  recommendedReviewPoints: RecommendedReviewPoint[];
  preparationStatus: {
    status: CasePreparationStatus;
    reasons: string[];
  };
  advisoryLayerNotice: string;
};

export type AnalyzeCaseResponse = {
  analysisId?: string;
  caseId: string;
  verificationStatus?: string;
  version?: number;
  report: CaseIntelligenceReport;
  source: "gemini" | "mock-fallback";
  generatedAt: string;
  notice: string;
  warning: string;
  advisoryOutputLabel: string;
  model?: string;
  modelUsed?: string;
  message?: string;
};

export type CaseChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: string[];
};

export type CaseAssistantRequest = {
  caseId: string;
  question: string;
  caseInput: FictionalCaseInput;
  analysisReport: CaseIntelligenceReport;
  uiLanguage?:
    | "en"
    | "as"
    | "bn"
    | "brx"
    | "doi"
    | "gu"
    | "hi"
    | "kn"
    | "ks"
    | "kok"
    | "mai"
    | "ml"
    | "mni"
    | "mr"
    | "ne"
    | "or"
    | "pa"
    | "sa"
    | "sat"
    | "sd"
    | "ta"
    | "te"
    | "ur";
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type CaseAssistantResponse = {
  answer: string;
  sources: string[];
  limitations: string[];
  requiresHumanVerification: true;
  model?: string;
};

const advisoryLayerNotice =
  "AI summaries, timelines, contradiction flags, and preparation assessments remain in a separate advisory layer. They must never overwrite or silently modify FIRs, witness statements, case diaries, evidence records, forensic reports, or any other official record.";

export const emptyElectronicEvidenceRecord = (): ElectronicEvidenceRecord => ({
  id: createClientId("electronic-evidence"),
  sourceDeviceType: "",
  makeModel: "",
  exhibitSerialNumber: "",
  collectionDateTime: "",
  hashAlgorithm: "",
  hashValue: "",
  chainOfCustodyStatus: "",
});

export const emptyWitness = (index: number): WitnessStatementInput => ({
  id: createClientId("witness"),
  label: `Witness ${index}`,
  statement: "",
  mentionedDateTime: "",
  mentionedLocation: "",
  sourceNotes: "",
});

export const sampleFictionalCase: FictionalCaseInput = {
  caseId: "CF-DEMO-2184",
  caseIdentification: {
    district: "Fictional North District",
    policeStation: "Fictional Riverside Police Station",
    fictionalCaseNumber: "CF/FIR-2184",
    year: "2026",
    actsAndSections: "Fictional demonstration references only",
    caseCategory: "Property offence demonstration",
  },
  occurrenceDetails: {
    occurrenceDate: "2026-07-30",
    occurrenceTime: "22:10",
    place: "Fictional municipal storage shed",
    address: "Fictional Riverside Road storage compound; no real address",
    distanceDirectionFromPoliceStation: "Approximately 2 km east of the fictional police station",
    informationReceivedDateTime: "2026-07-31 08:35",
    generalDiaryReference: "Fictional GD entry GD-082/2026",
  },
  caseNarrative: {
    incidentSummary:
      "A fictional report describes a night-time break-in at a municipal storage shed near Riverside Road.",
    detailedCaseContents:
      "Two locked cabinets were found open during the morning inspection. The fictional inventory custodian reported uncertainty about whether materials were missing. The scene notes mention a damaged cabinet latch, rear-lane shoe impression, and partial CCTV coverage from nearby cameras.",
    delayReason:
      "Fictional delay note: the incident was noticed during morning opening and reported after preliminary inventory checking.",
  },
  people: {
    complainantInformantSummary:
      "Fictional municipal inventory custodian summary only; no real name, address, phone number, Aadhaar number, passport number, or identity document.",
    personDetails:
      "Unknown persons. One fictional account mentions two people near a service gate; another mentions one person near the rear lane.",
    witnesses: [
      {
        id: "witness-1",
        label: "Witness 1 - fictional security guard",
        statement:
          "A fictional security guard says a dark hatchback stopped near the service gate at about 22:10 and two people entered through the east side entrance.",
        mentionedDateTime: "2026-07-30 22:10",
        mentionedLocation: "Service gate / east side entrance",
        sourceNotes: "Fictional beat note summary entered for demonstration.",
      },
      {
        id: "witness-2",
        label: "Witness 2 - fictional nearby shopkeeper",
        statement:
          "A fictional nearby shopkeeper says the area was quiet until around 23:00, when one person wearing a light jacket walked away from the rear lane.",
        mentionedDateTime: "2026-07-30 23:00",
        mentionedLocation: "Rear lane",
        sourceNotes: "Fictional oral statement summary entered for demonstration.",
      },
    ],
  },
  evidence: {
    physicalEvidence:
      "Broken cabinet latch, partial shoe impression near rear lane, and fictional inventory log printout.",
    digitalEvidence:
      "Two low-resolution fictional CCTV clips from adjacent road cameras.",
    propertyInvolved:
      "Fictional municipal storage materials; inventory discrepancy not yet confirmed.",
    investigationUpdates:
      "Initial scene notes have been organised. CCTV time stamps need confirmation. Inventory owner has not yet confirmed whether any article is missing.",
    chainOfCustodyNotes:
      "Fictional exhibit labels are partially prepared. One transfer time and receiving officer confirmation are missing.",
    forensicRequestDetails:
      "Fictional request for latch examination, shoe impression comparison, and CCTV enhancement.",
    electronicEvidenceRecords: [
      {
        id: "electronic-evidence-1",
        sourceDeviceType: "Fictional CCTV export",
        makeModel: "DemoCam DC-200",
        exhibitSerialNumber: "CF-2184-DV-01",
        collectionDateTime: "2026-07-31 09:25",
        hashAlgorithm: "SHA-256",
        hashValue: "fictional-hash-value-not-for-real-evidence",
        chainOfCustodyStatus: "Fictional intake recorded; officer verification pending",
      },
    ],
  },
  createdAt: "2026-07-31T15:00:00.000Z",
};

export function createClientId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildMockAnalysis(input: FictionalCaseInput): CaseIntelligenceReport {
  const witnessA = input.people.witnesses[0];
  const witnessB = input.people.witnesses[1];
  const electronicRecord = input.evidence.electronicEvidenceRecords[0];

  return {
    neutralSummary: `${caseDisplayName(input)} is a fictional demonstration packet from ${input.caseIdentification.policeStation || "a fictional police station"}. The submitted material can be organised into a working advisory view, but the reported time window, location references, property status, chain-of-custody notes, and forensic request framing need authorised officer verification.`,
    timeline: [
      {
        stage: "Occurrence window",
        observation:
          "Occurrence details provide a date, time, place, and police-station distance/direction reference for orientation.",
        source: "Occurrence details",
      },
      {
        stage: "Information received",
        observation:
          "Information received date/time and a general diary reference are supplied as fictional tracking fields.",
        source: "Occurrence details",
      },
      {
        stage: "Witness accounts",
        observation:
          "Witness cards mention different times and locations that should be checked against the submitted narrative and evidence notes.",
        source: "People section",
      },
      {
        stage: "Evidence preparation",
        observation:
          "Physical, digital, property, forensic, and chain-of-custody notes are present, with some review points still open.",
        source: "Evidence section",
      },
    ],
    contradictions: [
      {
        topic: "Time and movement near the scene",
        accountA: witnessA?.statement || "First fictional witness statement not supplied.",
        accountB: witnessB?.statement || "Second fictional witness statement not supplied.",
        observation:
          "These accounts differ and require human verification. The difference should not be treated as proof of deception or fault.",
      },
      {
        topic: "Location reference",
        accountA: witnessA?.mentionedLocation || "First fictional location reference not supplied.",
        accountB: witnessB?.mentionedLocation || "Second fictional location reference not supplied.",
        observation:
          "The mentioned locations should be compared with scene notes, camera coverage, and officer observations.",
      },
    ],
    missingInformation: [
      "Confirmation that all submitted details are fictional and contain no real personal identifiers.",
      "Officer confirmation of any property loss or damage beyond the initial summary.",
      "Complete chain-of-custody transfer time and receiving-officer verification.",
      "Clear forensic questions for each requested examination.",
    ],
    evidenceGaps: [
      {
        item: "Digital evidence time source",
        reason:
          "CCTV or electronic record timing should be checked before using it in a timeline.",
      },
      {
        item: "Electronic evidence hash record",
        reason: electronicRecord?.hashValue
          ? "A hash value is listed, but the collection and custody context still needs officer review."
          : "No hash value is listed for the optional electronic evidence record.",
      },
      {
        item: "Property status",
        reason:
          "The property involved field should distinguish confirmed loss, damage, and items still under verification.",
      },
    ],
    forensicRequestReview: [
      {
        item: "Forensic request details",
        status: input.evidence.forensicRequestDetails ? "Review pending" : "Information incomplete",
        note:
          "The request should specify the examination requested for each fictional exhibit without implying a legal conclusion.",
      },
      {
        item: "Chain-of-custody notes",
        status: input.evidence.chainOfCustodyNotes ? "Officer verification needed" : "Information incomplete",
        note:
          "Transfer, custody, and receipt notes should be checked before supervisory review.",
      },
      {
        item: "Electronic evidence record",
        status: input.evidence.electronicEvidenceRecords.length ? "Record supplied" : "No electronic record supplied",
        note:
          "Optional electronic evidence metadata should be internally consistent and remain fictional.",
      },
    ],
    recommendedReviewPoints: [
      {
        reviewPoint: "Verify statement differences against scene and evidence notes.",
        rationale:
          "The advisory system may highlight differences, but an authorised officer must confirm what they mean.",
      },
      {
        reviewPoint: "Check that no real identifiers were entered into the demonstration record.",
        rationale:
          "The prototype must remain a fictional-data-only environment.",
      },
      {
        reviewPoint: "Review forensic questions and chain-of-custody completeness.",
        rationale:
          "Preparation status should support officer review without deciding legal completeness or prosecution readiness.",
      },
    ],
    preparationStatus: {
      status: "Awaiting forensic material",
      reasons: [
        "Forensic request and chain-of-custody fields need officer review.",
        "Statement differences require human verification.",
        "This is an advisory case-preparation signal only, not a prosecution-readiness or legal-completeness decision.",
      ],
    },
    advisoryLayerNotice,
  };
}

export function caseDisplayName(input: FictionalCaseInput) {
  return [
    input.caseIdentification.fictionalCaseNumber,
    input.caseIdentification.year,
    input.caseIdentification.caseCategory,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function isCasePreparationStatus(value: unknown): value is CasePreparationStatus {
  return typeof value === "string" && casePreparationStatuses.includes(value as CasePreparationStatus);
}

export function validateCaseInput(value: unknown): FictionalCaseInput | null {
  const input = toRecord(value);
  if (!input) return null;

  const caseIdentification = parseCaseIdentification(input.caseIdentification);
  const occurrenceDetails = parseOccurrenceDetails(input.occurrenceDetails);
  const caseNarrative = parseCaseNarrative(input.caseNarrative);
  const people = parsePeopleDetails(input.people);
  const evidence = parseEvidenceDetails(input.evidence);
  const caseId = asText(input.caseId);

  if (
    !caseId ||
    !caseIdentification ||
    !occurrenceDetails ||
    !caseNarrative ||
    !people ||
    !evidence
  ) {
    return null;
  }

  return {
    caseId,
    caseIdentification,
    occurrenceDetails,
    caseNarrative,
    people,
    evidence,
    createdAt: asText(input.createdAt) || new Date().toISOString(),
  };
}

export function validateAnalysisReport(value: unknown): CaseIntelligenceReport | null {
  const report = toRecord(value);
  if (!report) return null;

  const preparationStatus = toRecord(report.preparationStatus);
  if (
    !preparationStatus ||
    !isCasePreparationStatus(preparationStatus.status) ||
    !Array.isArray(preparationStatus.reasons)
  ) {
    return null;
  }

  const requiredArrayFields = [
    report.timeline,
    report.contradictions,
    report.missingInformation,
    report.evidenceGaps,
    report.forensicRequestReview,
    report.recommendedReviewPoints,
  ];

  if (requiredArrayFields.some((field) => !Array.isArray(field))) return null;

  const parsed: CaseIntelligenceReport = {
    neutralSummary: asText(report.neutralSummary),
    timeline: parseObjectList(report.timeline, ["stage", "observation", "source"]),
    contradictions: parseObjectList(report.contradictions, [
      "topic",
      "accountA",
      "accountB",
      "observation",
    ]),
    missingInformation: parseTextList(report.missingInformation),
    evidenceGaps: parseObjectList(report.evidenceGaps, ["item", "reason"]),
    forensicRequestReview: parseObjectList(report.forensicRequestReview, ["item", "status", "note"]),
    recommendedReviewPoints: parseObjectList(report.recommendedReviewPoints, [
      "reviewPoint",
      "rationale",
    ]),
    preparationStatus: {
      status: preparationStatus.status,
      reasons: parseTextList(preparationStatus.reasons),
    },
    advisoryLayerNotice: asText(report.advisoryLayerNotice) || advisoryLayerNotice,
  };

  if (
    !parsed.neutralSummary ||
    !asText(report.advisoryLayerNotice) ||
    hasProhibitedDecisionLanguage(parsed)
  ) {
    return null;
  }

  return parsed;
}

function parseCaseIdentification(value: unknown): CaseIdentification | null {
  const record = toRecord(value);
  if (!record) return null;

  const parsed = {
    district: asText(record.district),
    policeStation: asText(record.policeStation),
    fictionalCaseNumber: asText(record.fictionalCaseNumber),
    year: asText(record.year),
    actsAndSections: asText(record.actsAndSections),
    caseCategory: asText(record.caseCategory),
  };

  return Object.values(parsed).every(Boolean) ? parsed : null;
}

function parseOccurrenceDetails(value: unknown): OccurrenceDetails | null {
  const record = toRecord(value);
  if (!record) return null;

  const parsed = {
    occurrenceDate: asText(record.occurrenceDate),
    occurrenceTime: asText(record.occurrenceTime),
    place: asText(record.place),
    address: asText(record.address),
    distanceDirectionFromPoliceStation: asText(record.distanceDirectionFromPoliceStation),
    informationReceivedDateTime: asText(record.informationReceivedDateTime),
    generalDiaryReference: asText(record.generalDiaryReference),
  };

  return Object.values(parsed).every(Boolean) ? parsed : null;
}

function parseCaseNarrative(value: unknown): CaseNarrative | null {
  const record = toRecord(value);
  if (!record) return null;

  const parsed = {
    incidentSummary: asText(record.incidentSummary),
    detailedCaseContents: asText(record.detailedCaseContents),
    delayReason: asText(record.delayReason),
  };

  return parsed.incidentSummary && parsed.detailedCaseContents ? parsed : null;
}

function parsePeopleDetails(value: unknown): PeopleDetails | null {
  const record = toRecord(value);
  if (!record) return null;

  const witnesses = Array.isArray(record.witnesses)
    ? record.witnesses
        .map((item, index) => parseWitness(item, index))
        .filter((item): item is WitnessStatementInput => Boolean(item))
    : [];

  const parsed = {
    complainantInformantSummary: asText(record.complainantInformantSummary),
    personDetails: asText(record.personDetails),
    witnesses,
  };

  return parsed.complainantInformantSummary && parsed.personDetails && witnesses.length >= 2
    ? parsed
    : null;
}

function parseEvidenceDetails(value: unknown): EvidenceDetails | null {
  const record = toRecord(value);
  if (!record) return null;

  const electronicEvidenceRecords = Array.isArray(record.electronicEvidenceRecords)
    ? record.electronicEvidenceRecords
        .map(parseElectronicEvidenceRecord)
        .filter((item): item is ElectronicEvidenceRecord => Boolean(item))
    : [];

  const parsed = {
    physicalEvidence: asText(record.physicalEvidence),
    digitalEvidence: asText(record.digitalEvidence),
    propertyInvolved: asText(record.propertyInvolved),
    investigationUpdates: asText(record.investigationUpdates),
    chainOfCustodyNotes: asText(record.chainOfCustodyNotes),
    forensicRequestDetails: asText(record.forensicRequestDetails),
    electronicEvidenceRecords,
  };

  return Object.entries(parsed).every(([key, value]) =>
    key === "electronicEvidenceRecords" ? true : Boolean(value),
  )
    ? parsed
    : null;
}

function parseWitness(value: unknown, index: number): WitnessStatementInput | null {
  const record = toRecord(value);
  if (!record) return null;

  const parsed = {
    id: asText(record.id) || `witness-${index + 1}`,
    label: asText(record.label) || `Witness ${index + 1}`,
    statement: asText(record.statement),
    mentionedDateTime: asText(record.mentionedDateTime),
    mentionedLocation: asText(record.mentionedLocation),
    sourceNotes: asText(record.sourceNotes),
  };

  return parsed.statement ? parsed : null;
}

function parseElectronicEvidenceRecord(value: unknown): ElectronicEvidenceRecord | null {
  const record = toRecord(value);
  if (!record) return null;

  const parsed = {
    id: asText(record.id) || createClientId("electronic-evidence"),
    sourceDeviceType: asText(record.sourceDeviceType),
    makeModel: asText(record.makeModel),
    exhibitSerialNumber: asText(record.exhibitSerialNumber),
    collectionDateTime: asText(record.collectionDateTime),
    hashAlgorithm: asText(record.hashAlgorithm),
    hashValue: asText(record.hashValue),
    chainOfCustodyStatus: asText(record.chainOfCustodyStatus),
  };

  return Object.entries(parsed).some(([key, value]) => key !== "id" && value) ? parsed : null;
}

function parseObjectList<T extends string>(
  value: unknown,
  keys: T[],
): Array<Record<T, string>> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = toRecord(item);
      if (!record) return null;

      const parsed = keys.reduce(
        (accumulator, key) => ({
          ...accumulator,
          [key]: asText(record[key]),
        }),
        {} as Record<T, string>,
      );

      return keys.every((key) => parsed[key]) ? parsed : null;
    })
    .filter((item): item is Record<T, string> => Boolean(item))
    .slice(0, 12);
}

function parseTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asText(item))
    .filter(Boolean)
    .slice(0, 12);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasProhibitedDecisionLanguage(report: CaseIntelligenceReport) {
  const serialized = JSON.stringify(report).toLowerCase();
  const prohibitedPatterns = [
    /\bis guilty\b/,
    /\bis innocent\b/,
    /\bshould be arrested\b/,
    /\brecommend arrest\b/,
    /\brecommend bail\b/,
    /\brecommend punishment\b/,
    /\brecommend conviction\b/,
    /\brecommend sentencing\b/,
    /\bconviction\b/,
    /\bprosecution ready\b/,
    /\bprosecution-ready\b/,
    /\bis lying\b/,
    /\blied\b/,
    /\bofficer is corrupt\b/,
  ];

  return prohibitedPatterns.some((pattern) => pattern.test(serialized));
}
