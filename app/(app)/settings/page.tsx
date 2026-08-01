import { redirect } from "next/navigation";
import { PageContainer } from "../../components/app-shell";
import {
  SettingsWorkspace,
  type SettingsField,
} from "../../components/settings-workspace";
import { createServerComponentClient } from "@/lib/supabase/server";

type DataRow = Record<string, unknown>;

const DEMO_PROFILE = {
  displayName: "Insp. Asha Rao",
  serviceNumber: "CF-DEMO-IO-001",
  designation: "Investigating Officer",
  rank: "Inspector",
  accountStatus: "Active",
};

const DEMO_POSTING = {
  organisationalUnit: "Fictional Zirakpur Subdivision",
  state: "Fictional Punjab Demonstration",
  district: "Fictional SAS Nagar District",
  station: "Fictional Zirakpur Police Station",
  role: "INVESTIGATING_OFFICER",
  postingTitle: "Investigating Officer",
  validFrom: "01 Jan 2026, 10:00 am",
  validUntil: "Not recorded",
  primaryPostingStatus: "Primary / Active",
};

export default async function SettingsPage() {
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user) {
    await ensureDemoOfficerData(supabase, user.id);
  }

  const profile = user ? await fetchOfficerProfile(supabase, user.id) : null;
  const posting = user ? await fetchOfficerPosting(supabase, user.id) : null;
  const metadata = user?.user_metadata ?? {};

  const accountFields: SettingsField[] = ([
    ["Display name", profile?.displayName || asText(metadata.display_name ?? metadata.name) || DEMO_PROFILE.displayName],
    ["Service number", profile?.serviceNumber || asText(metadata.service_number) || DEMO_PROFILE.serviceNumber],
    ["Designation", profile?.designation || asText(metadata.designation) || DEMO_PROFILE.designation],
    ["Rank", profile?.rank || asText(metadata.rank) || DEMO_PROFILE.rank],
    ["Account status", profile?.accountStatus || DEMO_PROFILE.accountStatus],
  ] satisfies Array<[string, unknown]>).map(toField);

  const postingFields: SettingsField[] = ([
    ["State", posting?.state || DEMO_POSTING.state],
    ["District", posting?.district || DEMO_POSTING.district],
    ["Subdivision or circle", posting?.organisationalUnit || DEMO_POSTING.organisationalUnit],
    ["Police station", posting?.station || DEMO_POSTING.station],
    ["Role", posting?.role || DEMO_POSTING.role],
    ["Posting title", posting?.postingTitle || DEMO_POSTING.postingTitle],
    ["Valid from", posting?.validFrom || DEMO_POSTING.validFrom],
    ["Valid until", posting?.validUntil || DEMO_POSTING.validUntil],
    ["Primary posting status", posting?.primaryPostingStatus || DEMO_POSTING.primaryPostingStatus],
  ] satisfies Array<[string, unknown]>).map(toField);

  const sessionFields: SettingsField[] = ([
    ["Signed-in email", user?.email],
    ["Current session status", "Authenticated"],
    ["Last sign-in time", formatDateOrText(user?.last_sign_in_at)],
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
  const row = await fetchFirstMatchingRow(supabase, [
    { table: "officer_profiles", columns: ["user_id", "auth_user_id", "id"] },
    { table: "profiles", columns: ["user_id", "auth_user_id", "id"] },
  ], userId);

  if (!row) return null;

  return {
    accountStatus: toTitleCase(asText(row.account_status ?? row.status) || "Active"),
    designation: asText(row.designation ?? row.posting_designation),
    displayName: asText(row.display_name ?? row.full_name ?? row.name),
    rank: asText(row.rank ?? row.rank_title),
    serviceNumber: asText(row.service_number ?? row.badge_number ?? row.employee_number),
  };
}

async function fetchOfficerPosting(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  userId: string,
) {
  const row = await fetchFirstMatchingRow(supabase, [
    { table: "officer_postings", columns: ["user_id", "auth_user_id", "officer_id", "profile_id"] },
    { table: "postings", columns: ["user_id", "auth_user_id", "officer_id", "profile_id"] },
  ], userId);

  if (!row) return null;

  return {
    district: asText(row.district ?? row.district_name),
    organisationalUnit: asText(row.organisational_unit ?? row.organizational_unit ?? row.unit),
    state: asText(row.state ?? row.state_name),
    postingTitle: asText(row.posting_title ?? row.title),
    primaryPostingStatus: toTitleCase(
      asText(row.primary_posting_status ?? row.posting_status ?? row.status) || "Not recorded",
    ),
    role: asText(row.role ?? row.role_title),
    station: asText(row.station ?? row.police_station ?? row.police_station_name),
    validFrom: formatDateOrText(row.valid_from ?? row.started_at ?? row.created_at),
    validUntil: formatDateOrText(row.valid_until ?? row.ends_at ?? row.expires_at),
  };
}

async function ensureDemoOfficerData(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  userId: string,
) {
  await upsertDemoRow(supabase, [
    {
      table: "officer_profiles",
      filterColumns: ["user_id", "auth_user_id", "id"],
      payload: {
        user_id: userId,
        auth_user_id: userId,
        display_name: DEMO_PROFILE.displayName,
        service_number: DEMO_PROFILE.serviceNumber,
        designation: DEMO_PROFILE.designation,
        rank: DEMO_PROFILE.rank,
        account_status: "active",
        status: "active",
      },
    },
    {
      table: "profiles",
      filterColumns: ["user_id", "auth_user_id", "id"],
      payload: {
        user_id: userId,
        auth_user_id: userId,
        display_name: DEMO_PROFILE.displayName,
        service_number: DEMO_PROFILE.serviceNumber,
        designation: DEMO_PROFILE.designation,
        rank: DEMO_PROFILE.rank,
        account_status: "active",
      },
    },
  ]);

  await upsertDemoRow(supabase, [
    {
      table: "officer_postings",
      filterColumns: ["user_id", "auth_user_id", "officer_id", "profile_id"],
      payload: {
        user_id: userId,
        auth_user_id: userId,
        role_code: "INVESTIGATING_OFFICER",
        role: "INVESTIGATING_OFFICER",
        posting_title: DEMO_POSTING.postingTitle,
        primary_posting: true,
        status: "active",
        active: true,
        valid_from: "2026-01-01",
        valid_until: null,
        state: DEMO_POSTING.state,
        district: DEMO_POSTING.district,
        organisational_unit: DEMO_POSTING.organisationalUnit,
        police_station: DEMO_POSTING.station,
      },
    },
    {
      table: "postings",
      filterColumns: ["user_id", "auth_user_id", "officer_id", "profile_id"],
      payload: {
        user_id: userId,
        auth_user_id: userId,
        role_code: "INVESTIGATING_OFFICER",
        role: "INVESTIGATING_OFFICER",
        posting_title: DEMO_POSTING.postingTitle,
        primary_posting: true,
        status: "active",
        active: true,
        valid_from: "2026-01-01",
        valid_until: null,
        state: DEMO_POSTING.state,
        district: DEMO_POSTING.district,
        organisational_unit: DEMO_POSTING.organisationalUnit,
        police_station: DEMO_POSTING.station,
      },
    },
  ]);
}

async function upsertDemoRow(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  attempts: Array<{ table: string; filterColumns: string[]; payload: DataRow }>,
) {
  for (const attempt of attempts) {
    for (const column of attempt.filterColumns) {
      const findResult = await supabase
        .schema("public")
        .from(attempt.table)
        .select("*")
        .eq(column, asText(attempt.payload.user_id ?? attempt.payload.auth_user_id) || "")
        .limit(1);

      if (findResult.error) continue;

      if (Array.isArray(findResult.data) && findResult.data[0]) {
        const rowId = asText((findResult.data[0] as DataRow).id);
        if (!rowId) continue;

        const updateResult = await supabase
          .schema("public")
          .from(attempt.table)
          .update(attempt.payload)
          .eq("id", rowId);

        if (!updateResult.error) return;
        continue;
      }

      const insertResult = await supabase
        .schema("public")
        .from(attempt.table)
        .insert(attempt.payload);

      if (!insertResult.error) return;
    }
  }
}

async function fetchFirstMatchingRow(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  attempts: Array<{ columns: string[]; table: string }>,
  userId: string,
) {
  for (const attempt of attempts) {
    for (const column of attempt.columns) {
      const orderedResult = await supabase
        .schema("public")
        .from(attempt.table)
        .select("*")
        .eq(column, userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!orderedResult.error && Array.isArray(orderedResult.data) && orderedResult.data[0]) {
        return orderedResult.data[0] as DataRow;
      }

      const fallbackResult = await supabase
        .schema("public")
        .from(attempt.table)
        .select("*")
        .eq(column, userId)
        .limit(1);

      if (!fallbackResult.error && Array.isArray(fallbackResult.data) && fallbackResult.data[0]) {
        return fallbackResult.data[0] as DataRow;
      }
    }
  }

  return null;
}

function toField([label, value]: [string, unknown]): SettingsField {
  return {
    label,
    value: asText(value) || "Not recorded",
  };
}

function formatDateOrText(value: unknown) {
  const text = asText(value);
  if (!text) return "Not recorded";

  const date = new Date(text);
  const looksLikeDate = Number.isFinite(date.valueOf()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(text);

  if (!looksLikeDate) return text;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
