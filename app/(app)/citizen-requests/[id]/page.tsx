import { redirect } from "next/navigation";
import { PageContainer } from "@/app/components/app-shell";
import { CitizenRequestDetailWorkspace } from "@/app/components/citizen-request-detail-workspace";
import { citizenPublicStatusLabel, formatPublicDate } from "@/app/lib/citizen-request-domain";
import { findDemoCitizenRequestById } from "@/lib/demo-citizen-requests";
import { getWorkspaceContext } from "@/app/lib/workspace-server";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function CitizenRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const supabase = await createServerComponentClient();
  const workspace = await getWorkspaceContext(supabase);

  if (!workspace) redirect("/login");
  if (workspace.workspaceRole !== "investigating" && workspace.workspaceRole !== "supervisory") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const requestData = findDemoCitizenRequestById(id);
  const mode = (await searchParams)?.mode;
  const readOnly = workspace.workspaceRole === "supervisory" || mode === "supervisory";

  if (!requestData) {
    return (
      <PageContainer eyebrow="Citizen Requests" title="Citizen Request" description="Request not found or access is not authorised.">
        <section className="dashboard-card cases-state" role="status">
          <strong>Request not found or access is not authorised.</strong>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      eyebrow="Citizen Requests"
      title={requestData.reference}
      description={`Submitted ${formatPublicDate(requestData.submittedAt)}. Public status: ${citizenPublicStatusLabel(requestData.publicStatus)}.`}
    >
      <CitizenRequestDetailWorkspace readOnly={readOnly} request={requestData} />
    </PageContainer>
  );
}
