export const DEMO_STATION_DATA = {
  scope: {
    state: "Punjab",
    district: "SAS Nagar District",
    subdivision: "Zirakpur Subdivision",
    policeStation: "Zirakpur Police Station",
    stationViewLabel: "Station View — Zirakpur Police Station",
  },

  totals: {
    assignedCases: 12,
    casesRequiringAttention: 10,
    awaitingForensicResponse: 1,
    readyForReview: 0,
    resolvedCases: 4,
    overdueActions: 9,
    casesWithNoRecentActivity: 0,
  },

  statusCounts: {
    open: 3,
    needsAttention: 3,
    awaitingForensics: 2,
    officerReview: 2,
    readyForReview: 0,
    resolved: 2,
  },

  preparation: {
    caseInformationIndexed: 100,
    witnessStatementsLinked: 58,
    forensicRequestCompleteness: 42,
    chainOfCustodyCompleteness: 67,
  },
} as const;
