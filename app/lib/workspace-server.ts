import { resolveWorkspaceRole, selectActivePostingRoleCode, type WorkspaceRole } from "./workspace-role";
import { createServerComponentClient } from "@/lib/supabase/server";

export type WorkspaceContext = {
  userId: string;
  workspaceRole: WorkspaceRole;
};

export async function getWorkspaceContext(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
): Promise<WorkspaceContext | null> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return null;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user?.id) {
    return null;
  }

  const { data: postingRows } = await supabase
    .schema("public")
    .from("user_postings")
    .select("role_code, valid_from, valid_until, is_primary, is_active, role, posting_role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("valid_from", { ascending: false })
    .limit(20);

  const postingRoleCode = selectActivePostingRoleCode(Array.isArray(postingRows) ? postingRows : []);
  const workspaceRole = resolveWorkspaceRole({
    postingRoleCode,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata,
  });

  return {
    userId: user.id,
    workspaceRole,
  };
}

export function isCitizenWorkspaceRole(role: WorkspaceRole) {
  return role === "citizen";
}
