import type { CSSProperties } from "react";
import { PageContainer } from "../../components/app-shell";

export default function CasesLoading() {
  return (
    <PageContainer
      eyebrow="Assigned case worklist"
      title="My Cases"
      description="Loading authorized cases from the signed-in Supabase session."
    >
      <section className="cases-worklist dashboard-card" aria-label="Loading assigned cases">
        <div className="dashboard-card-header cases-worklist-header">
          <div>
            <p>Authorized records</p>
            <h3>Assigned case list</h3>
          </div>
          <span className="cases-result-count">Loading</span>
        </div>
        <div className="cases-loading-state">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} style={{ "--app-delay": `${index * 80}ms` } as CSSProperties} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
