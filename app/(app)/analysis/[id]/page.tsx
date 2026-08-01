import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseAnalysisFlow } from "../../../components/case-analysis-flow";
import { Icon, PageContainer } from "../../../components/app-shell";
import {
  parseCaseInputFromCaseRow,
  readText,
  selectSavedAnalysis,
  type DataRow,
  type SavedAnalysisVersion,
} from "../../../lib/case-analysis-store";
import { createServerComponentClient } from "@/lib/supabase/server";

export default async function AnalysisPlaceholderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseId = decodeURIComponent(id);
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data: caseData, error: caseError } = await supabase
    .schema("public")
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError || !caseData) {
    return (
      <PageContainer
        eyebrow="Advisory AI analysis"
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
    caseId;

  const { data: analysisRows } = await supabase
    .schema("public")
    .from("case_analyses")
    .select("*")
    .eq("case_id", caseId)
    .limit(30);

  const initialCaseInput = parseCaseInputFromCaseRow(caseData as DataRow, caseId, caseReference);
  const saved = selectSavedAnalysis((analysisRows ?? []) as DataRow[], caseId);
  const initialResponse = saved?.response ?? null;
  const analysisVersions: SavedAnalysisVersion[] = saved?.versions ?? [];

  return (
    <PageContainer
      eyebrow="Advisory AI analysis"
      title="Case Intelligence Report"
      description={`Review structured advisory observations for ${caseReference}. All AI output requires authorised officer verification.`}
    >
      <CaseAnalysisFlow
        analysisVersions={analysisVersions}
        caseId={caseId}
        caseInput={initialCaseInput}
        caseReference={caseReference}
        initialResponse={initialResponse}
      />
    </PageContainer>
  );
}
