import { isSupervisoryPostingRoleCode } from "./supervisory-scope";

export type WorkspaceRole = "citizen" | "investigating" | "supervisory" | "unknown";

type DataRow = Record<string, unknown>;

export function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function normaliseText(value: string): string {
  return value.trim().toLowerCase();
}

export function isCitizenRoleCode(roleCode: string): boolean {
  return normaliseText(roleCode) === "citizen";
}

export function isInvestigatingRoleCode(roleCode: string): boolean {
  return normaliseText(roleCode) === "investigating_officer";
}

export function roleFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";

  const data = metadata as Record<string, unknown>;
  return normaliseText(
    asText(data.role) ||
      asText(data.user_role) ||
      asText(data.account_role) ||
      asText(data.role_code),
  );
}

export function selectActivePostingRoleCode(rows: DataRow[], now = Date.now()): string {
  const candidate = rows
    .filter((row) => {
      const isActive = row.is_active === true || row.active === true;
      if (!isActive) return false;

      const validFrom = Date.parse(asText(row.valid_from));
      const validUntilText = asText(row.valid_until);
      const validUntil = validUntilText ? Date.parse(validUntilText) : Number.NaN;

      if (!Number.isFinite(validFrom) || validFrom > now) return false;
      if (Number.isFinite(validUntil) && validUntil <= now) return false;
      return true;
    })
    .sort((a, b) => {
      const aPrimary = a.is_primary === true ? 1 : 0;
      const bPrimary = b.is_primary === true ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;

      const aEpoch = Date.parse(asText(a.valid_from));
      const bEpoch = Date.parse(asText(b.valid_from));
      const aSafe = Number.isFinite(aEpoch) ? aEpoch : 0;
      const bSafe = Number.isFinite(bEpoch) ? bEpoch : 0;
      return bSafe - aSafe;
    })[0];

  return normaliseText(asText(candidate?.role_code ?? candidate?.role ?? candidate?.posting_role));
}

export function resolveWorkspaceRole(options: {
  postingRoleCode: string;
  appMetadata?: unknown;
  userMetadata?: unknown;
}): WorkspaceRole {
  const postingRoleCode = normaliseText(options.postingRoleCode);

  if (isSupervisoryPostingRoleCode(postingRoleCode)) return "supervisory";
  if (isInvestigatingRoleCode(postingRoleCode)) return "investigating";
  if (isCitizenRoleCode(postingRoleCode)) return "citizen";

  const appRole = roleFromMetadata(options.appMetadata);
  const userRole = roleFromMetadata(options.userMetadata);

  if (isCitizenRoleCode(appRole) || isCitizenRoleCode(userRole)) return "citizen";
  if (isSupervisoryPostingRoleCode(appRole) || isSupervisoryPostingRoleCode(userRole)) return "supervisory";
  if (isInvestigatingRoleCode(appRole) || isInvestigatingRoleCode(userRole)) return "investigating";

  return "unknown";
}
