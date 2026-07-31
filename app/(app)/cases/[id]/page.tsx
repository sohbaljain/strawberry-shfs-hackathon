import { PageContainer, PlaceholderPanel } from "../../../components/app-shell";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageContainer
      eyebrow="Phase 1 placeholder"
      title={`Case ${id}`}
      description="Case detail pages are intentionally placeholder-only in Phase 1."
    >
      <PlaceholderPanel
        title="Case detail placeholder"
        body={`This fictional case route is wired for ${id}, but no real records, uploads, analysis reports, or data handling are implemented.`}
      />
    </PageContainer>
  );
}
