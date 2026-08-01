import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../../components/app-shell";
import { CaseAssistantWorkspace } from "../../../components/case-assistant";
import { buildMockAnalysis } from "../../../lib/caseflow-analysis";
import {
  parseCaseInputFromCaseRow,
  readText,
  selectSavedAnalysis,
  type DataRow,
} from "../../../lib/case-analysis-store";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function CaseAssistantPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const routeCaseId = decodeURIComponent(caseId);
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data: caseData, error: caseError } = await supabase
    .schema("public")
    .from("cases")
    .select("*")
    .eq("id", routeCaseId)
    .maybeSingle();

  if (caseError || !caseData) {
    return (
      <PageContainer
        eyebrow="Case assistant"
        title="Case unavailable"
        description="The requested case could not be opened with the current signed-in session."
        actions={
          <Link className="app-link-button subtle" href="/cases">
            Back to My Cases
            <Icon name="arrow" />
          </Link>
        }
      >
        <section className="dashboard-card cases-state case-access-state">
          <Icon name="alert" />
          <strong>Case not found or access is not authorised.</strong>
          <p>CaseFlow AI relies on Supabase row-level security for this workspace.</p>
        </section>
      </PageContainer>
    );
  }

  const caseReference =
    readText(caseData.case_reference ?? caseData.caseReference ?? caseData.reference ?? caseData.fictional_case_number) ||
    routeCaseId;
  const caseTitle = readText(caseData.title ?? caseData.case_title ?? caseData.caseTitle);
  const caseInput = parseCaseInputFromCaseRow(caseData as DataRow, routeCaseId, caseReference);

  const { data: analysisRows } = await supabase
    .schema("public")
    .from("case_analyses")
    .select("*")
    .eq("case_id", routeCaseId)
    .limit(30);

  const saved = selectSavedAnalysis((analysisRows ?? []) as DataRow[], routeCaseId);
  const analysisReport = saved?.response.report ?? buildMockAnalysis(caseInput);
  const analysisSource = saved?.response.source ?? "mock-fallback";

  return (
    <CaseAssistantWorkspace
      analysisReport={analysisReport}
      analysisSource={analysisSource}
      caseDisplayName={caseTitle ? `${caseReference} - ${caseTitle}` : caseReference}
      caseId={routeCaseId}
      caseInput={caseInput}
    />
  );
}
