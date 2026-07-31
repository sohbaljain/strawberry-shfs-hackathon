import { PageContainer, PlaceholderPanel } from "../../../components/app-shell";

export default async function AnalysisPlaceholderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageContainer
      eyebrow="Phase 1 placeholder"
      title={`Analysis ${id}`}
      description="Analysis reports and AI integration are intentionally not built in Phase 1."
    >
      <PlaceholderPanel
        title="Analysis placeholder"
        body={`This fictional route is available for ${id}. Gemini integration, report generation, and evidence analysis are not active.`}
      />
    </PageContainer>
  );
}
