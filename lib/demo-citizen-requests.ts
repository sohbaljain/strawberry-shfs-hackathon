export type DemoCitizenRequestRecord = {
  assignedOfficer: string;
  convertedToCase: boolean;
  description: string;
  id: string;
  internalStatus: string;
  lastActivity: string;
  location: string;
  priority: string;
  publicMessage: string;
  publicStatus: string;
  reference: string;
  requestType: string;
  station: string;
  submittedAt: string;
  title: string;
};

export const DEMO_CITIZEN_REQUESTS = [
  {
    id: "demo-citizen-request-001",
    reference: "CIT-DEMO-2026-1042",
    requestType: "Suspicious Activity Report",
    title: "Repeated late-night activity near closed shops",
    description:
      "A citizen reported repeated late-night activity near a closed market area and requested local review.",
    location: "Sector 20 Market, Zirakpur",
    submittedAt: "2026-07-31T19:20:00+05:30",
    publicStatus: "Under Review",
    internalStatus: "under_review",
    priority: "Medium",
    assignedOfficer: "Inspector Arjun Mehta",
    station: "Zirakpur Police Station",
    lastActivity: "Reviewed by assigned officer",
    publicMessage: "Your request has been received and is being reviewed.",
    convertedToCase: false,
  },
  {
    id: "demo-citizen-request-002",
    reference: "CIT-DEMO-2026-1038",
    requestType: "Lost Property Report",
    title: "Lost document wallet near bus stand",
    description:
      "A wallet containing identification documents was reported lost near the main bus stand.",
    location: "Zirakpur Bus Stand",
    submittedAt: "2026-07-30T14:10:00+05:30",
    publicStatus: "Additional Information Requested",
    internalStatus: "additional_information_requested",
    priority: "Low",
    assignedOfficer: "Sub-Inspector Neha Sharma",
    station: "Zirakpur Police Station",
    lastActivity: "Contact information requested from citizen",
    publicMessage: "Additional information is required to continue reviewing this request.",
    convertedToCase: false,
  },
  {
    id: "demo-citizen-request-003",
    reference: "CIT-DEMO-2026-1027",
    requestType: "Community Safety Concern",
    title: "Broken street lighting near pedestrian crossing",
    description:
      "A citizen reported poor visibility and safety concerns near a pedestrian crossing.",
    location: "VIP Road, Zirakpur",
    submittedAt: "2026-07-28T09:35:00+05:30",
    publicStatus: "Referred for Action",
    internalStatus: "referred_for_action",
    priority: "Medium",
    assignedOfficer: "Inspector Arjun Mehta",
    station: "Zirakpur Police Station",
    lastActivity: "Referred to the appropriate civic authority",
    publicMessage: "Your request has been reviewed and referred to the appropriate authority.",
    convertedToCase: false,
  },
  {
    id: "demo-citizen-request-004",
    reference: "CIT-DEMO-2026-1015",
    requestType: "Non-Emergency Incident Report",
    title: "Minor vehicle damage reported in parking area",
    description:
      "A citizen reported damage to a parked vehicle and requested documentation of the incident.",
    location: "Dhakoli residential parking area",
    submittedAt: "2026-07-25T18:45:00+05:30",
    publicStatus: "Closed",
    internalStatus: "closed",
    priority: "Low",
    assignedOfficer: "Sub-Inspector Neha Sharma",
    station: "Zirakpur Police Station",
    lastActivity: "Request reviewed and closed",
    publicMessage: "The review of this request has been completed.",
    convertedToCase: false,
  },
] as const satisfies readonly DemoCitizenRequestRecord[];

export type DemoCitizenRequest = DemoCitizenRequestRecord;

export const DEMO_CITIZEN_REQUEST_REFERENCES = DEMO_CITIZEN_REQUESTS.map((request) => request.reference);

const demoCitizenStorageKey = "caseflow:demo-citizen-requests:v1";

export function findDemoCitizenRequestByReference(reference: string) {
  const value = reference.trim().toUpperCase();
  return loadStoredDemoCitizenRequests().find((request) => request.reference === value) ?? DEMO_CITIZEN_REQUESTS.find((request) => request.reference === value) ?? null;
}

export function findDemoCitizenRequestById(id: string) {
  return loadStoredDemoCitizenRequests().find((request) => request.id === id) ?? DEMO_CITIZEN_REQUESTS.find((request) => request.id === id) ?? null;
}

export function loadStoredDemoCitizenRequests() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(demoCitizenStorageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is DemoCitizenRequestRecord => isDemoCitizenRequest(item));
  } catch {
    return [];
  }
}

export function saveStoredDemoCitizenRequest(request: DemoCitizenRequestRecord) {
  if (typeof window === "undefined") return;

  const existing = loadStoredDemoCitizenRequests().filter((item) => item.reference !== request.reference);
  window.localStorage.setItem(demoCitizenStorageKey, JSON.stringify([request, ...existing]));
}

export function createDemoCitizenReference() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `CIT-DEMO-${year}-${suffix}`;
}

export function formatDemoCitizenDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isDemoCitizenRequest(value: unknown): value is DemoCitizenRequestRecord {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;
  return ["id", "reference", "requestType", "title", "description", "location", "submittedAt", "publicStatus", "internalStatus", "priority", "assignedOfficer", "station", "lastActivity", "publicMessage"].every(
    (key) => typeof row[key] === "string" || typeof row[key] === "boolean",
  );
}
