export const CITIZEN_REQUEST_TYPES = [
  "General Information Request",
  "Suspicious Activity Report",
  "Lost Property Report",
  "Community Safety Concern",
  "Non-Emergency Incident Report",
] as const;

export type CitizenRequestType = (typeof CITIZEN_REQUEST_TYPES)[number];

export const CITIZEN_PUBLIC_STATUSES = [
  "Submitted",
  "Received",
  "Under Review",
  "Additional Information Requested",
  "Referred for Action",
  "Closed",
] as const;

export type CitizenPublicStatus = (typeof CITIZEN_PUBLIC_STATUSES)[number];

export const CITIZEN_PRIORITIES = ["Unreviewed", "Low", "Medium", "High"] as const;

export type CitizenPriority = (typeof CITIZEN_PRIORITIES)[number];

export function isCitizenRequestType(value: string): value is CitizenRequestType {
  return CITIZEN_REQUEST_TYPES.includes(canonical(value) as CitizenRequestType);
}

export function isCitizenPublicStatus(value: string): value is CitizenPublicStatus {
  return ["submitted", "received", "under review", "additional information requested", "referred for action", "closed"].includes(canonicalStatus(value));
}

export function isCitizenPriority(value: string): value is CitizenPriority {
  return CITIZEN_PRIORITIES.includes(titleCase(value) as CitizenPriority);
}

export function citizenRequestTypeLabel(value: string) {
  return isCitizenRequestType(value) ? canonical(value) : "Unknown request";
}

export function citizenPublicStatusLabel(value: string) {
  const status = canonicalStatus(value);

  switch (status) {
    case "submitted":
      return "Submitted";
    case "received":
      return "Received";
    case "under review":
    case "under_review":
      return "Under Review";
    case "additional information requested":
    case "additional_info_requested":
      return "Additional Information Requested";
    case "referred for action":
    case "referred_for_action":
      return "Referred for Action";
    case "closed":
      return "Closed";
    default:
      return "Submitted";
  }
}

export function citizenPriorityLabel(value: string) {
  const priority = titleCase(value);

  switch (priority) {
    case "Low":
    case "Medium":
    case "High":
    case "Unreviewed":
      return priority;
    default:
      return "Unreviewed";
  }
}

export function citizenPriorityRank(value: string) {
  switch (titleCase(value)) {
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
      return 1;
    case "Unreviewed":
    default:
      return 0;
  }
}

export function citizenStatusRank(value: string) {
  switch (canonicalStatus(value)) {
    case "submitted":
      return 0;
    case "received":
      return 1;
    case "under review":
      return 2;
    case "additional information requested":
      return 3;
    case "referred for action":
      return 4;
    case "closed":
      return 5;
    default:
      return 0;
  }
}

export function citizenPublicUpdateText(status: string, latestSummary?: string | null) {
  const statusLabel = citizenPublicStatusLabel(status);
  const summary = (latestSummary ?? "").trim();

  if (summary) return summary;

  switch (canonicalStatus(status)) {
    case "submitted":
      return "Your request has been submitted and is waiting to be received.";
    case "received":
      return "Your request has been received and is queued for review.";
    case "under review":
      return "Your request is under review.";
    case "additional information requested":
      return "Additional information has been requested.";
    case "referred for action":
      return "Your request has been referred for action.";
    case "closed":
      return "Your request has been closed.";
    default:
      return `${statusLabel}.`;
  }
}

export function canonical(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function canonicalStatus(value: string) {
  return canonical(value).toLowerCase();
}

export function titleCase(value: string) {
  return canonical(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseLooseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date : null;
}

export function formatPublicDate(value: unknown) {
  const date = parseLooseDate(value);
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTrackDate(value: unknown) {
  const date = parseLooseDate(value);
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function citizenRequestValidationMessage() {
  return "Please complete every required field with a non-emergency request.";
}
