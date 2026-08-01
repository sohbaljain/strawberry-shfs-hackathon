import { validateCaseInput } from "../../lib/caseflow-analysis";
import { createServerComponentClient } from "@/lib/supabase/server";

type CreateCaseRpcResponse = {
  case_id?: string;
  case_reference?: string;
};

type DataRow = Record<string, unknown>;

type ResolvedScope = {
  districtUnitId: string;
  stationUnitId: string;
};

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const caseInput = validateCaseInput(payload);

  if (!caseInput) {
    return Response.json(
      { error: "A complete fictional case intake packet is required." },
      { status: 400 },
    );
  }

  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userError || !userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const resolvedScope = await resolvePostingScope(supabase, userId);

  if (process.env.NODE_ENV !== "production") {
    console.info("Create case posting scope", {
      postingFound: resolvedScope.status.postingFound,
      stationResolved: resolvedScope.status.stationResolved,
      subdivisionResolved: resolvedScope.status.subdivisionResolved,
      districtResolved: resolvedScope.status.districtResolved,
    });
  }

  if (!resolvedScope.scope) {
    return Response.json(
      {
        error: "Active posting is missing district or station scope.",
      },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .schema("public")
    .rpc("create_investigation_case", { p_case_payload: caseInput });

  if (error) {
    console.error("Create case RPC failed:", {
      code: error.code,
      details: error.details,
      message: error.message,
    });

    return Response.json(
      {
        error:
          error.message ||
          "Case could not be created. Please verify your profile and active posting.",
      },
      { status: 403 },
    );
  }

  const record = (data ?? {}) as CreateCaseRpcResponse;
  const caseId = typeof record.case_id === "string" ? record.case_id : "";
  const caseReference =
    typeof record.case_reference === "string" ? record.case_reference : caseId;

  if (!caseId) {
    return Response.json({ error: "Case creation did not return a case ID." }, { status: 500 });
  }

  return Response.json({ caseId, caseReference }, { status: 201 });
}

async function resolvePostingScope(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  userId: string,
) {
  const nowIso = new Date().toISOString();
  const { data: postingRows } = await supabase
    .schema("public")
    .from("user_postings")
    .select("user_id, organisational_unit_id, role_code, posting_title, valid_from, valid_until, is_primary, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("valid_from", { ascending: false })
    .limit(20);

  const activePosting = (Array.isArray(postingRows) ? postingRows : [])
    .filter((row) => isPostingActiveAt(row as DataRow, nowIso))[0] as DataRow | undefined;

  if (!activePosting) {
    return {
      scope: null,
      status: {
        postingFound: false,
        stationResolved: false,
        subdivisionResolved: false,
        districtResolved: false,
      },
    };
  }

  const stationId = asText(activePosting.organisational_unit_id);
  if (!stationId) {
    return {
      scope: null,
      status: {
        postingFound: true,
        stationResolved: false,
        subdivisionResolved: false,
        districtResolved: false,
      },
    };
  }

  const station = await getUnitById(supabase, stationId);
  if (!station) {
    return {
      scope: null,
      status: {
        postingFound: true,
        stationResolved: false,
        subdivisionResolved: false,
        districtResolved: false,
      },
    };
  }

  const subdivisionId = asText(station.parent_unit_id);
  const subdivision = subdivisionId ? await getUnitById(supabase, subdivisionId) : null;

  if (!subdivision) {
    return {
      scope: null,
      status: {
        postingFound: true,
        stationResolved: true,
        subdivisionResolved: false,
        districtResolved: false,
      },
    };
  }

  const districtId = asText(subdivision.parent_unit_id);
  const district = districtId ? await getUnitById(supabase, districtId) : null;

  if (!district) {
    return {
      scope: null,
      status: {
        postingFound: true,
        stationResolved: true,
        subdivisionResolved: true,
        districtResolved: false,
      },
    };
  }

  const scope: ResolvedScope = {
    stationUnitId: asText(station.id),
    districtUnitId: asText(district.id),
  };

  if (!scope.stationUnitId || !scope.districtUnitId) {
    return {
      scope: null,
      status: {
        postingFound: true,
        stationResolved: Boolean(scope.stationUnitId),
        subdivisionResolved: true,
        districtResolved: Boolean(scope.districtUnitId),
      },
    };
  }

  return {
    scope,
    status: {
      postingFound: true,
      stationResolved: true,
      subdivisionResolved: true,
      districtResolved: true,
    },
  };
}

async function getUnitById(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  unitId: string,
) {
  const { data } = await supabase
    .schema("public")
    .from("organisational_units")
    .select("id, parent_unit_id")
    .eq("id", unitId)
    .maybeSingle();

  return data ?? null;
}

function isPostingActiveAt(row: DataRow, nowIso: string) {
  const validFrom = asText(row.valid_from);
  const validUntil = asText(row.valid_until);

  if (!validFrom) return false;
  if (Date.parse(validFrom) > Date.parse(nowIso)) return false;
  if (validUntil && Date.parse(validUntil) <= Date.parse(nowIso)) return false;
  return true;
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
