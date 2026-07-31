import { PageContainer, PlaceholderPanel } from "../../components/app-shell";

export default function SettingsPage() {
  return (
    <PageContainer
      eyebrow="Phase 1 placeholder"
      title="Settings"
      description="Settings are not part of the current implementation phase."
    >
      <PlaceholderPanel
        title="Settings placeholder"
        body="This page exists only to keep the sidebar route valid. No preferences, permissions, roles, or authentication settings are active."
      />
    </PageContainer>
  );
}
