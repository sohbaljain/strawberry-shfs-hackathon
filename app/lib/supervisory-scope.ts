export const SUPERVISORY_ROLE_CODES = [
  "supervising_officer",
  "supervisor",
  "station_house_officer",
  "station_head",
  "circle_supervisor",
  "subdivision_supervisor",
  "district_supervisor",
  "regional_supervisor",
  "state_supervisor",
] as const;

export const DEMO_SUPERVISORY_SCOPE = {
  state: "Punjab",
  stateCode: "PB",
  district: "SAS Nagar District",
  districtCode: "PB-SASN",
  subdivision: "Zirakpur Subdivision",
  subdivisionCode: "PB-SASN-ZRK-SD",
  policeStation: "Zirakpur Police Station",
  policeStationCode: "PB-SASN-ZRK-PS",
  scopeType: "Station View",
  workspaceRole: "Station Head",
  displayTitle: "Station Head - Zirakpur Police Station",
} as const;

export function isSupervisoryPostingRoleCode(roleCode: string): boolean {
  return SUPERVISORY_ROLE_CODES.includes(roleCode as (typeof SUPERVISORY_ROLE_CODES)[number]);
}
