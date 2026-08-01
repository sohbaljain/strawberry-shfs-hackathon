import { CaseCreateForm } from "../../../components/case-create-form";
import { PageContainer } from "../../../components/app-shell";

export default function NewCasePage() {
  return (
    <PageContainer
      eyebrow="Fictional case intake"
      title="Create Fictional Case"
      description="Enter an Indian police-record-inspired fictional packet for AI-assisted organisation, gap review, and case preparation analysis. This is not an FIR or official record."
    >
      <CaseCreateForm />
    </PageContainer>
  );
}
