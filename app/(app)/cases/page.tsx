import { PageContainer, PlaceholderPanel } from "../../components/app-shell";

export default function CasesPage() {
  return (
    <PageContainer
      eyebrow="Phase 1 placeholder"
      title="My Cases"
      description="This route is present so sidebar navigation works. A full case list is not part of Phase 1."
    >
      <PlaceholderPanel
        title="Case list placeholder"
        body="Future phases can expand this into an assigned-case worklist. For now, the dashboard table is the only populated case view and uses fictional mock records."
      />
    </PageContainer>
  );
}
