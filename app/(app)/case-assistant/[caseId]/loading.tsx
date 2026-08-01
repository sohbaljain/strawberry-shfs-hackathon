import { Icon } from "../../../components/app-shell";

export default function LoadingCaseAssistant() {
  return (
    <section className="case-assistant-page-loading" aria-label="Loading case assistant">
      <Icon name="activity" />
      <strong>Opening Case Assistant</strong>
      <span>Preparing the fictional case chat workspace...</span>
    </section>
  );
}
