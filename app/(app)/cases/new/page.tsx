import { PageContainer, PlaceholderPanel } from "../../../components/app-shell";

export default function NewCasePage() {
  return (
    <PageContainer
      eyebrow="Phase 1 placeholder"
      title="Create Case"
      description="The create-case form is intentionally not built in this phase."
    >
      <PlaceholderPanel
        title="No case intake form yet"
        body="This placeholder confirms the route and shared shell. No uploads, database writes, authentication, or real case handling are active."
      />
    </PageContainer>
  );
}
