import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/app/components/app-shell";
import { CitizenRequestDirectory } from "@/app/components/citizen-request-directory";
import { DEMO_CITIZEN_REQUESTS } from "@/lib/demo-citizen-requests";
import { getWorkspaceContext } from "@/app/lib/workspace-server";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function CitizenRequestsPage() {
  const supabase = await createServerComponentClient();
  const workspace = await getWorkspaceContext(supabase);

  if (!workspace) redirect("/login");
  if (workspace.workspaceRole !== "investigating" && workspace.workspaceRole !== "supervisory") {
    redirect("/dashboard");
  }

  return (
    <PageContainer
      eyebrow="Citizen Requests"
      title="Citizen Requests"
      description="Review the hardcoded demonstration citizen requests available for IO review."
      actions={
        <Link className="button button-secondary" href="/oversight">
          Back to Oversight
        </Link>
      }
    >
      <CitizenRequestDirectory requests={[...DEMO_CITIZEN_REQUESTS]} />
    </PageContainer>
  );
}
