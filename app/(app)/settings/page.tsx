import { redirect } from "next/navigation";
import { PageContainer } from "../../components/app-shell";
import { CitizenSettingsWorkspace } from "../../components/citizen-settings-workspace";
import {
  SettingsWorkspace,
  type SettingsField,
} from "../../components/settings-workspace";
import { asText, formatDateOrText, normaliseText, toRows, toTitleCase } from "@/app/lib/officer-workspace";
import { getWorkspaceContext } from "@/app/lib/workspace-server";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const workspace = await getWorkspaceContext(supabase);

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.workspaceRole === "citizen") {
    return (
      <PageContainer
        eyebrow="Citizen settings"
        title="Settings"
        description="Manage this demonstration portal on your current device."
      >
        <CitizenSettingsWorkspace />
      </PageContainer>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const profile = user ? await fetchOfficerProfile(supabase, user.id) : null;
  const posting = user ? await fetchOfficerPosting(supabase, user.id) : null;
  const metadata = user?.user_metadata ?? {};

  const accountFields: SettingsField[] = ([
    ["Display name", profile?.displayName || asText(metadata.display_name ?? metadata.name) || "Not available"],
    ["Service number", profile?.serviceNumber || asText(metadata.service_number) || "Not available"],
    ["Designation", profile?.designation || asText(metadata.designation) || "Not available"],
    ["Rank", profile?.rank || asText(metadata.rank) || "Not available"],
    ["Account status", profile?.accountStatus || "Unknown"],
  ] satisfies Array<[string, unknown]>).map(toField);

  const postingFields: SettingsField[] = ([
    ["State", posting?.state || "Not available"],
    ["District", posting?.district || "Not available"],
    ["Subdivision or circle", posting?.subdivision || "Not available"],
    ["Police station", posting?.station || "Not available"],
    ["Role", posting?.role || "Not available"],
    ["Posting title", posting?.postingTitle || "Not available"],
    ["Valid from", posting?.validFrom || "Not available"],
    ["Valid until", posting?.validUntil || "No end date"],
    ["Primary posting status", posting?.primaryStatus || "Not available"],
  ] satisfies Array<[string, unknown]>).map(toField);

  const sessionFields: SettingsField[] = ([
    ["Signed-in email", user?.email || "Not available"],
    ["Current session status", "Authenticated"],
    ["Last sign-in time", formatDateOrText(user?.last_sign_in_at) || "Not available"],
  ] satisfies Array<[string, unknown]>).map(toField);

  return (
    <PageContainer
      eyebrow="Officer settings"
      title="Settings"
      description="View account, posting, interface, privacy, and session information for the signed-in demonstration workspace."
    >
      <SettingsWorkspace
        accountFields={accountFields}
        postingFields={postingFields}
        sessionFields={sessionFields}
      />
    </PageContainer>
  );
}

async function fetchOfficerProfile(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  userId: string,
) {
  const attempts = [
    { table: "profiles", columns: ["id", "user_id", "auth_user_id"] },
    { table: "officer_profiles", columns: ["id", "user_id", "auth_user_id"] },
  ];

  for (const attempt of attempts) {
    for (const column of attempt.columns) {
      const result = await supabase
        .schema("public")
        .from(attempt.table)
        .select("*")
        .eq(column, userId)
        .limit(1);

      const row = toRows(result.data)[0];
      if (!row) continue;

      return {
        accountStatus: toTitleCase(asText(row.account_status ?? row.status) || "Active"),
        designation: asText(row.designation ?? row.posting_designation),
        displayName: asText(row.display_name ?? row.full_name ?? row.name),
        rank: asText(row.rank ?? row.rank_title),
        serviceNumber: asText(row.service_number ?? row.badge_number ?? row.employee_number),
      };
    }
  }

  return null;
}

async function fetchOfficerPosting(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  userId: string,
) {
  const nowIso = new Date().toISOString();
  const postingResult = await supabase
    .schema("public")
    .from("user_postings")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("valid_from", { ascending: false })
    .limit(20);

  const postingRow = toRows(postingResult.data).find((row) => {
    const validFrom = asText(row.valid_from);
    const validUntil = asText(row.valid_until);

    if (!validFrom) return false;
    if (Date.parse(validFrom) > Date.parse(nowIso)) return false;
    if (validUntil && Date.parse(validUntil) <= Date.parse(nowIso)) return false;
    return true;
  });

  if (!postingRow) return null;

  const station = await lookupOrganisationalUnit(supabase, asText(postingRow.organisational_unit_id));
  const subdivision = station?.parentUnitId
    ? await lookupOrganisationalUnit(supabase, station.parentUnitId)
    : null;
  const district = subdivision?.parentUnitId
    ? await lookupOrganisationalUnit(supabase, subdivision.parentUnitId)
    : null;
  const state = district?.parentUnitId
    ? await lookupOrganisationalUnit(supabase, district.parentUnitId)
    : null;

  const roleRaw = asText(postingRow.role ?? postingRow.role_code ?? postingRow.posting_role);
  const role = roleRaw ? toTitleCase(roleRaw.replaceAll("_", " ")) : "Not available";

  const statusText = normaliseText(asText(postingRow.status));
  const activeFlag = postingRow.active === true || postingRow.is_active === true || statusText === "active";
  const primaryFlag = postingRow.primary_posting === true || postingRow.is_primary === true;

  return {
    district: district?.name || asText(postingRow.district ?? postingRow.district_name),
    postingTitle: asText(postingRow.posting_title ?? postingRow.title),
    primaryStatus: primaryFlag || activeFlag ? "Primary / Active" : "Secondary / Inactive",
    role,
    state: state?.name || asText(postingRow.state ?? postingRow.state_name),
    station: station?.name || asText(postingRow.station ?? postingRow.police_station ?? postingRow.police_station_name),
    subdivision: subdivision?.name || asText(postingRow.organisational_unit ?? postingRow.organizational_unit ?? postingRow.unit),
    validFrom: formatDateOrText(postingRow.valid_from ?? postingRow.started_at ?? postingRow.created_at),
    validUntil: asText(postingRow.valid_until ?? postingRow.ends_at ?? postingRow.expires_at)
      ? formatDateOrText(postingRow.valid_until ?? postingRow.ends_at ?? postingRow.expires_at)
      : "No end date",
  };
}

async function lookupOrganisationalUnit(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  unitId: string,
) {
  if (!unitId) return null;

  const result = await supabase
    .schema("public")
    .from("organisational_units")
    .select("id, name, parent_unit_id")
    .eq("id", unitId)
    .maybeSingle();

  const row = result.data;
  if (!row) return null;

  return {
    id: asText(row.id),
    name: asText(row.name),
    parentUnitId: asText(row.parent_unit_id),
  };
}

function toField([label, value]: [string, unknown]): SettingsField {
  return {
    label,
    value: asText(value) || "Not available",
  };
}
