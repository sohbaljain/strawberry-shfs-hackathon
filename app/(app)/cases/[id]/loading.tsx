import { PageContainer } from "../../../components/app-shell";

export default function CaseDetailLoading() {
  return (
    <PageContainer
      eyebrow="Operational case workspace"
      title="Loading case"
      description="Loading the authorised case workspace from Supabase."
    >
      <section className="case-detail-grid" aria-label="Loading case workspace">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="dashboard-card case-detail-loading-card" key={index}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </section>
    </PageContainer>
  );
}
