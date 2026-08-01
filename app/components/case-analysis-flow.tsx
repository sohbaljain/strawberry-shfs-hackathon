"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ADVISORY_OUTPUT_LABEL,
  CASE_DRAFT_STORAGE_PREFIX,
  CASE_REPORT_STORAGE_PREFIX,
  FICTIONAL_DATA_NOTICE,
  REPORT_WARNING,
  buildMockAnalysis,
  caseDisplayName,
  sampleFictionalCase,
  validateAnalysisReport,
  validateCaseInput,
  type AnalyzeCaseResponse,
  type FictionalCaseInput,
} from "../lib/caseflow-analysis";
import {
  buildCaseFlowPdf,
  caseFlowPdfFileName,
  type AdvisoryPdfMode,
} from "../lib/caseflow-pdf";
import { Icon } from "./app-shell";
import { CaseAssistant } from "./case-assistant";

type FlowStatus = "loading" | "ready" | "error";

const analysisSteps = [
  "Preparing fictional case packet",
  "Checking statement consistency",
  "Reviewing evidence and forensic request details",
  "Building advisory report",
];

export function CaseAnalysisFlow({
  caseId,
  caseReference,
}: {
  caseId: string;
  caseReference?: string;
}) {
  const [status, setStatus] = useState<FlowStatus>("loading");
  const [response, setResponse] = useState<AnalyzeCaseResponse | null>(null);
  const [caseInput, setCaseInput] = useState<FictionalCaseInput | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const runAnalysis = async () => {
      window.scrollTo({ top: 0, left: 0 });
      setStatus("loading");
      setMessage("");

      const storedReport = readStoredReport(caseId);
      if (storedReport) {
        setResponse(storedReport);
        setCaseInput(readStoredDraft(caseId) || buildSampleInput(caseId, caseReference));
        setStatus("ready");
        return;
      }

      const input = readStoredDraft(caseId) || buildSampleInput(caseId, caseReference);
      setCaseInput(input);

      try {
        const [apiResponse] = await Promise.all([
          fetch("/api/analyze-case", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }),
          delay(1350),
        ]);

        if (!apiResponse.ok) {
          throw new Error(`Analysis request failed with status ${apiResponse.status}.`);
        }

        const data = (await apiResponse.json()) as AnalyzeCaseResponse;

        if (data.caseId !== caseId) {
          setMessage("This analysis does not belong to the requested case.");
          setStatus("error");
          return;
        }

        if (cancelled) return;

        window.sessionStorage.setItem(
          `${CASE_REPORT_STORAGE_PREFIX}${caseId}`,
          JSON.stringify(data),
        );
        setResponse(data);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;

        const fallback: AnalyzeCaseResponse = {
          caseId,
          report: buildMockAnalysis(input),
          source: "mock-fallback",
          generatedAt: new Date().toISOString(),
          notice: FICTIONAL_DATA_NOTICE,
          warning: REPORT_WARNING,
          advisoryOutputLabel: ADVISORY_OUTPUT_LABEL,
          message:
            error instanceof Error
              ? error.message
              : "The analysis request could not be completed.",
        };

        setResponse(fallback);
        setMessage(fallback.message || "");
        setStatus("error");
      }
    };

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [caseId, caseReference]);

  if (status === "loading") {
    return <AnalysisLoadingScreen caseId={caseId} />;
  }

  if (!response) {
    return <AnalysisError caseId={caseId} message={message || "No analysis report is available."} />;
  }

  return (
    <CaseIntelligenceReportView
      caseId={caseId}
      caseInput={caseInput}
      message={message || response.message}
      response={response}
      showFallbackNotice={status === "error" || response.source === "mock-fallback"}
    />
  );
}

function AnalysisLoadingScreen({ caseId }: { caseId: string }) {
  const [activeStep, setActiveStep] = useState(0);
  const progress = useMemo(() => ((activeStep + 1) / analysisSteps.length) * 100, [activeStep]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, analysisSteps.length - 1));
    }, 430);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="analysis-loading-layout app-page-enter">
      <div className="dashboard-card analysis-loading-card">
        <div className="analysis-orbit" aria-hidden="true">
          <span />
          <Icon name="activity" />
        </div>
        <p className="page-eyebrow">AI analysis in progress</p>
        <h3>Building Case Intelligence Report</h3>
        <p>
          Case {caseId} is being organised into an advisory report. The output remains separate from official records and requires officer verification.
        </p>

        <div className="analysis-progress" style={{ "--progress": `${progress}%` } as CSSProperties}>
          <i>
            <b />
          </i>
          <strong>{analysisSteps[activeStep]}</strong>
        </div>

        <ol className="analysis-step-list">
          {analysisSteps.map((step, index) => (
            <li
              className={index <= activeStep ? "is-active" : undefined}
              key={step}
              style={{ "--app-delay": `${index * 90}ms` } as CSSProperties}
            >
              <Icon name={index <= activeStep ? "check" : "clipboard"} />
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="analysis-skeleton-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function CaseIntelligenceReportView({
  caseId,
  caseInput,
  message,
  response,
  showFallbackNotice,
}: {
  caseId: string;
  caseInput: FictionalCaseInput | null;
  message?: string;
  response: AnalyzeCaseResponse;
  showFallbackNotice: boolean;
}) {
  const { report } = response;
  const assistantCaseInput = caseInput || buildSampleInput(caseId);
  const displayName = caseDisplayName(assistantCaseInput) || caseId;

  const handleDownload = (mode: AdvisoryPdfMode) => {
    const pdfBytes = buildCaseFlowPdf(response, mode, caseInput);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = caseFlowPdfFileName(caseId, mode);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 500);
  };

  return (
    <section className="report-layout app-page-enter">
      <header className="dashboard-card report-cover-card">
        <div className="report-cover-main">
          <span className="report-source-pill">
            <Icon name={response.source === "gemini" ? "activity" : "alert"} />
            {response.source === "gemini" ? "Gemini structured JSON" : "Mock fallback report"}
          </span>
          <h3>Case Intelligence Report</h3>
          <p>
            Advisory observations for {displayName}. These summaries are designed to help an authorised officer review gaps, differences, and preparation issues.
          </p>
        </div>
        <div className="report-status-panel">
          <span>Case Preparation Status</span>
          <strong>{report.preparationStatus.status}</strong>
          <em>Advisory only, not a legal-completeness decision.</em>
        </div>
      </header>

      <div className="report-warning-card" role="note">
        <Icon name="alert" />
        <span>{response.warning}</span>
      </div>

      {showFallbackNotice ? (
        <div className="report-fallback-card" role="status">
          <Icon name="shield" />
          <span>
            Gemini was not used for this response. {message || "A fictional mock analysis was displayed instead."}
          </span>
        </div>
      ) : null}

      <ReportSection
        eyebrow="Neutral summary"
        icon="file"
        title="Case summary"
      >
        <p className="report-summary-text">{report.neutralSummary}</p>
      </ReportSection>

      <ReportSection eyebrow="Timeline" icon="activity" title="Structured timeline">
        <ol className="report-timeline">
          {report.timeline.map((item, index) => (
            <li key={`${item.stage}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{item.stage}</strong>
                <p>{item.observation}</p>
                <em>{item.source}</em>
              </div>
            </li>
          ))}
        </ol>
      </ReportSection>

      <ReportSection
        eyebrow="Statement review"
        icon="alert"
        title="Contradictions requiring human verification"
      >
        <div className="report-card-grid">
          {report.contradictions.map((item, index) => (
            <article className="report-mini-card" key={`${item.topic}-${index}`}>
              <strong>{item.topic}</strong>
              <p>{item.accountA}</p>
              <p>{item.accountB}</p>
              <em>{item.observation}</em>
            </article>
          ))}
        </div>
      </ReportSection>

      <div className="report-two-column">
        <ReportSection eyebrow="Missing information" icon="clipboard" title="Open information needs">
          <ReportList items={report.missingInformation} />
        </ReportSection>

        <ReportSection eyebrow="Evidence review" icon="layers" title="Evidence gaps">
          <div className="report-gap-list">
            {report.evidenceGaps.map((gap, index) => (
              <article key={`${gap.item}-${index}`}>
                <strong>{gap.item}</strong>
                <p>{gap.reason}</p>
              </article>
            ))}
          </div>
        </ReportSection>
      </div>

      <ReportSection
        eyebrow="Officer confirmation"
        icon="check"
        title="AI-detected gaps and suggested review points"
      >
        <div className="report-action-list">
          {report.recommendedReviewPoints.map((item, index) => (
            <article key={`${item.reviewPoint}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{item.reviewPoint}</strong>
                <p>{item.rationale}</p>
              </div>
            </article>
          ))}
        </div>
      </ReportSection>

      <div className="report-two-column">
        <ReportSection eyebrow="Forensics" icon="activity" title="Forensic request review">
          <div className="forensic-review-list">
            {report.forensicRequestReview.map((item, index) => (
              <article key={`${item.item}-${index}`}>
                <span>{item.status}</span>
                <strong>{item.item}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection
          eyebrow="Preparation status"
          icon="shield"
          title="Status reasons"
        >
          <ReportList items={report.preparationStatus.reasons} />
        </ReportSection>
      </div>

      <footer className="dashboard-card report-separation-card">
        <Icon name="shield" />
        <div>
          <strong>Strict advisory-layer separation</strong>
          <p>{report.advisoryLayerNotice}</p>
        </div>
      </footer>

      <div className="report-actions">
        <button
          className="button button-secondary"
          data-testid="download-advisory-report"
          onClick={() => handleDownload("advisory")}
          type="button"
        >
          <Icon name="file" />
          Download Advisory Report
        </button>
        <button
          className="button button-secondary"
          data-testid="download-one-page-summary"
          onClick={() => handleDownload("summary")}
          type="button"
        >
          <Icon name="clipboard" />
          Download One-Page Summary
        </button>
        <Link className="button button-secondary" href="/cases/new">
          <Icon name="plus" />
          Create another fictional case
        </Link>
        <Link className="button button-primary" href="/dashboard">
          <Icon name="dashboard" />
          Return to dashboard
        </Link>
      </div>

      <CaseAssistant
        analysisReport={report}
        caseId={caseId}
        caseInput={assistantCaseInput}
        caseReference={displayName}
        key={caseId}
      />
    </section>
  );
}

function ReportSection({
  children,
  eyebrow,
  icon,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  icon: "activity" | "alert" | "check" | "clipboard" | "file" | "layers" | "shield";
  title: string;
}) {
  return (
    <section className="dashboard-card report-section-card">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <Icon name={icon} />
      </div>
      <div className="report-section-body">{children}</div>
    </section>
  );
}

function ReportList({ items }: { items: string[] }) {
  return (
    <ul className="report-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          <Icon name="check" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AnalysisError({ caseId, message }: { caseId: string; message: string }) {
  return (
    <section className="dashboard-card analysis-error-card app-page-enter">
      <Icon name="alert" />
      <h3>Analysis unavailable for {caseId}</h3>
      <p>{message}</p>
      <Link className="button button-primary" href="/cases/new">
        Create fictional case
      </Link>
    </section>
  );
}

function readStoredDraft(caseId: string): FictionalCaseInput | null {
  try {
    const raw = window.sessionStorage.getItem(`${CASE_DRAFT_STORAGE_PREFIX}${caseId}`);
    return raw ? validateCaseInput(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function readStoredReport(caseId: string): AnalyzeCaseResponse | null {
  try {
    const raw = window.sessionStorage.getItem(`${CASE_REPORT_STORAGE_PREFIX}${caseId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AnalyzeCaseResponse>;
    const report = validateAnalysisReport(parsed.report);

    if (!report || parsed.caseId !== caseId) return null;

    return {
      caseId,
      report,
      source: parsed.source === "gemini" ? "gemini" : "mock-fallback",
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date().toISOString(),
      notice: typeof parsed.notice === "string" ? parsed.notice : FICTIONAL_DATA_NOTICE,
      warning: typeof parsed.warning === "string" ? parsed.warning : REPORT_WARNING,
      advisoryOutputLabel:
        typeof parsed.advisoryOutputLabel === "string"
          ? parsed.advisoryOutputLabel
          : ADVISORY_OUTPUT_LABEL,
      message: typeof parsed.message === "string" ? parsed.message : undefined,
    };
  } catch {
    return null;
  }
}

function buildSampleInput(caseId: string, caseReference?: string): FictionalCaseInput {
  return {
    ...sampleFictionalCase,
    caseId,
    caseIdentification: {
      ...sampleFictionalCase.caseIdentification,
      fictionalCaseNumber: caseReference || caseId,
    },
    createdAt: new Date().toISOString(),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
