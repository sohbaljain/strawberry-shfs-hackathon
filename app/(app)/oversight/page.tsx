import { PageContainer, PlaceholderPanel } from "../../components/app-shell";

export default function OversightPage() {
  return (
    <PageContainer
      eyebrow="Phase 1 placeholder"
      title="Oversight"
      description="Senior oversight views are intentionally not built in Phase 1."
    >
      <PlaceholderPanel
        title="Oversight placeholder"
        body="This route confirms the shared shell and navigation only. Senior dashboards, reporting workflows, and role-specific permissions are not implemented."
      />
    </PageContainer>
  );
}
