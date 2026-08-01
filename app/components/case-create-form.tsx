"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  createClientId,
  emptyElectronicEvidenceRecord,
  emptyWitness,
  sampleFictionalCase,
  type ElectronicEvidenceRecord,
  type FictionalCaseInput,
  type WitnessStatementInput,
} from "../lib/caseflow-analysis";
import { Icon } from "./app-shell";

type CaseFormState = Omit<FictionalCaseInput, "caseId" | "createdAt">;

type TextFieldPath =
  | "caseIdentification.district"
  | "caseIdentification.policeStation"
  | "caseIdentification.fictionalCaseNumber"
  | "caseIdentification.year"
  | "caseIdentification.actsAndSections"
  | "caseIdentification.caseCategory"
  | "occurrenceDetails.occurrenceDate"
  | "occurrenceDetails.occurrenceTime"
  | "occurrenceDetails.place"
  | "occurrenceDetails.address"
  | "occurrenceDetails.distanceDirectionFromPoliceStation"
  | "occurrenceDetails.informationReceivedDateTime"
  | "occurrenceDetails.generalDiaryReference"
  | "caseNarrative.incidentSummary"
  | "caseNarrative.detailedCaseContents"
  | "caseNarrative.delayReason"
  | "people.complainantInformantSummary"
  | "people.personDetails"
  | "evidence.physicalEvidence"
  | "evidence.digitalEvidence"
  | "evidence.propertyInvolved"
  | "evidence.investigationUpdates"
  | "evidence.chainOfCustodyNotes"
  | "evidence.forensicRequestDetails";

const initialWitness = (index: number): WitnessStatementInput => ({
  id: `witness-initial-${index}`,
  label: `Witness ${index}`,
  statement: "",
  mentionedDateTime: "",
  mentionedLocation: "",
  sourceNotes: "",
});

const initialState: CaseFormState = {
  caseIdentification: {
    district: "",
    policeStation: "",
    fictionalCaseNumber: "",
    year: "2026",
    actsAndSections: "",
    caseCategory: "",
  },
  occurrenceDetails: {
    occurrenceDate: "",
    occurrenceTime: "",
    place: "",
    address: "",
    distanceDirectionFromPoliceStation: "",
    informationReceivedDateTime: "",
    generalDiaryReference: "",
  },
  caseNarrative: {
    incidentSummary: "",
    detailedCaseContents: "",
    delayReason: "",
  },
  people: {
    complainantInformantSummary: "",
    personDetails: "",
    witnesses: [initialWitness(1), initialWitness(2)],
  },
  evidence: {
    physicalEvidence: "",
    digitalEvidence: "",
    propertyInvolved: "",
    investigationUpdates: "",
    chainOfCustodyNotes: "",
    forensicRequestDetails: "",
    electronicEvidenceRecords: [],
  },
};

const requiredFieldPaths: TextFieldPath[] = [
  "caseIdentification.district",
  "caseIdentification.policeStation",
  "caseIdentification.fictionalCaseNumber",
  "caseIdentification.year",
  "caseIdentification.actsAndSections",
  "caseIdentification.caseCategory",
  "occurrenceDetails.occurrenceDate",
  "occurrenceDetails.occurrenceTime",
  "occurrenceDetails.place",
  "occurrenceDetails.address",
  "occurrenceDetails.distanceDirectionFromPoliceStation",
  "occurrenceDetails.informationReceivedDateTime",
  "occurrenceDetails.generalDiaryReference",
  "caseNarrative.incidentSummary",
  "caseNarrative.detailedCaseContents",
  "people.complainantInformantSummary",
  "people.personDetails",
  "evidence.physicalEvidence",
  "evidence.digitalEvidence",
  "evidence.propertyInvolved",
  "evidence.investigationUpdates",
  "evidence.chainOfCustodyNotes",
  "evidence.forensicRequestDetails",
];

export function CaseCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState<CaseFormState>(initialState);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const completedCoreFields = useMemo(
    () => requiredFieldPaths.filter((path) => getTextField(form, path).trim()).length,
    [form],
  );
  const completedWitnessStatements = form.people.witnesses.filter((witness) =>
    witness.statement.trim(),
  ).length;
  const completedRequired = completedCoreFields + Math.min(completedWitnessStatements, 2);
  const totalRequired = requiredFieldPaths.length + 2;
  const hasTwoWitnessStatements = completedWitnessStatements >= 2;
  const hasCaseIdentity = Boolean(
    form.caseIdentification.district.trim() &&
      form.caseIdentification.policeStation.trim() &&
      form.caseIdentification.fictionalCaseNumber.trim() &&
      form.caseIdentification.year.trim() &&
      form.caseIdentification.actsAndSections.trim() &&
      form.caseIdentification.caseCategory.trim(),
  );
  const hasOccurrenceAndGd = Boolean(
    form.occurrenceDetails.occurrenceDate.trim() &&
      form.occurrenceDetails.occurrenceTime.trim() &&
      form.occurrenceDetails.place.trim() &&
      form.occurrenceDetails.address.trim() &&
      form.occurrenceDetails.distanceDirectionFromPoliceStation.trim() &&
      form.occurrenceDetails.informationReceivedDateTime.trim() &&
      form.occurrenceDetails.generalDiaryReference.trim(),
  );
  const hasNarrative = Boolean(
    form.caseNarrative.incidentSummary.trim() && form.caseNarrative.detailedCaseContents.trim(),
  );
  const hasEvidenceAndForensics = Boolean(
    form.evidence.physicalEvidence.trim() &&
      form.evidence.digitalEvidence.trim() &&
      form.evidence.propertyInvolved.trim() &&
      form.evidence.investigationUpdates.trim() &&
      form.evidence.chainOfCustodyNotes.trim() &&
      form.evidence.forensicRequestDetails.trim(),
  );

  const requiredGroups = [
    { complete: hasCaseIdentity, label: "Fictional case identity" },
    { complete: hasOccurrenceAndGd, label: "Occurrence and General Diary details" },
    { complete: hasNarrative, label: "Case narrative" },
    { complete: hasTwoWitnessStatements, label: "Two witness statements" },
    { complete: hasEvidenceAndForensics, label: "Evidence and forensic information" },
  ];
  const missingGroups = requiredGroups.filter((group) => !group.complete).map((group) => group.label);
  const isComplete = requiredGroups.every((group) => group.complete);

  const updateField = (path: TextFieldPath, value: string) => {
    setForm((current) => setTextField(current, path, value));
  };

  const loadSampleCase = () => {
    setSubmitAttempted(false);
    const sample: CaseFormState = {
      caseIdentification: sampleFictionalCase.caseIdentification,
      occurrenceDetails: sampleFictionalCase.occurrenceDetails,
      caseNarrative: sampleFictionalCase.caseNarrative,
      people: sampleFictionalCase.people,
      evidence: sampleFictionalCase.evidence,
    };

    setForm({
      ...sample,
      people: {
        ...sample.people,
        witnesses: sample.people.witnesses.map((witness, index) => ({
          ...witness,
          id: witness.id || createClientId(`witness-${index + 1}`),
        })),
      },
      evidence: {
        ...sample.evidence,
        electronicEvidenceRecords: sample.evidence.electronicEvidenceRecords.map((record, index) => ({
          ...record,
          id: record.id || createClientId(`electronic-evidence-${index + 1}`),
        })),
      },
    });
  };

  const addWitness = () => {
    setForm((current) => ({
      ...current,
      people: {
        ...current.people,
        witnesses: [...current.people.witnesses, emptyWitness(current.people.witnesses.length + 1)],
      },
    }));
  };

  const updateWitness = (
    witnessId: string,
    field: keyof Omit<WitnessStatementInput, "id">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      people: {
        ...current.people,
        witnesses: current.people.witnesses.map((witness) =>
          witness.id === witnessId ? { ...witness, [field]: value } : witness,
        ),
      },
    }));
  };

  const removeWitness = (witnessId: string) => {
    setForm((current) => ({
      ...current,
      people: {
        ...current.people,
        witnesses:
          current.people.witnesses.length <= 2
            ? current.people.witnesses
            : current.people.witnesses.filter((witness) => witness.id !== witnessId),
      },
    }));
  };

  const addElectronicEvidenceRecord = () => {
    setForm((current) => ({
      ...current,
      evidence: {
        ...current.evidence,
        electronicEvidenceRecords: [
          ...current.evidence.electronicEvidenceRecords,
          emptyElectronicEvidenceRecord(),
        ],
      },
    }));
  };

  const updateElectronicEvidenceRecord = (
    recordId: string,
    field: keyof Omit<ElectronicEvidenceRecord, "id">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      evidence: {
        ...current.evidence,
        electronicEvidenceRecords: current.evidence.electronicEvidenceRecords.map((record) =>
          record.id === recordId ? { ...record, [field]: value } : record,
        ),
      },
    }));
  };

  const removeElectronicEvidenceRecord = (recordId: string) => {
    setForm((current) => ({
      ...current,
      evidence: {
        ...current.evidence,
        electronicEvidenceRecords: current.evidence.electronicEvidenceRecords.filter(
          (record) => record.id !== recordId,
        ),
      },
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setSubmitError("");

    if (!isComplete) return;

    const draft: FictionalCaseInput = {
      caseId: createClientId("draft-case"),
      ...form,
      people: {
        ...form.people,
        witnesses: form.people.witnesses.filter((witness) => witness.statement.trim()),
      },
      evidence: {
        ...form.evidence,
        electronicEvidenceRecords: form.evidence.electronicEvidenceRecords.filter((record) =>
          Object.entries(record).some(([key, value]) => key !== "id" && value.trim()),
        ),
      },
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);

    void fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { caseId?: string; error?: string }
          | null;

        if (!response.ok || !data?.caseId) {
          throw new Error(
            data?.error ||
              "Case could not be created. Please verify your profile and active posting.",
          );
        }

        router.push(`/analysis/${encodeURIComponent(data.caseId)}`);
      })
      .catch((error: unknown) => {
        setSubmitError(
          error instanceof Error && error.message
            ? error.message
            : "Case could not be created right now.",
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <form className="case-create-layout app-page-enter" onSubmit={handleSubmit}>
      <section className="case-intake-stack">
        <IntakeNotice />

        <IntakeSection
          eyebrow="Section 01"
          icon="file"
          title="Case identification"
          action={
            <button className="app-link-button subtle" type="button" onClick={loadSampleCase}>
              <Icon name="clipboard" />
              Load sample data
            </button>
          }
        >
          <div className="case-form-grid compact">
            <InputField
              invalid={isInvalid(form, "caseIdentification.district", submitAttempted)}
              label="District"
              onChange={updateField}
              path="caseIdentification.district"
              placeholder="Fictional North District"
              value={form.caseIdentification.district}
            />
            <InputField
              invalid={isInvalid(form, "caseIdentification.policeStation", submitAttempted)}
              label="Police station"
              onChange={updateField}
              path="caseIdentification.policeStation"
              placeholder="Fictional Riverside Police Station"
              value={form.caseIdentification.policeStation}
            />
            <InputField
              invalid={isInvalid(form, "caseIdentification.fictionalCaseNumber", submitAttempted)}
              label="Fictional case/FIR number"
              onChange={updateField}
              path="caseIdentification.fictionalCaseNumber"
              placeholder="CF/FIR-2184"
              value={form.caseIdentification.fictionalCaseNumber}
            />
            <InputField
              invalid={isInvalid(form, "caseIdentification.year", submitAttempted)}
              label="Year"
              onChange={updateField}
              path="caseIdentification.year"
              placeholder="2026"
              type="number"
              value={form.caseIdentification.year}
            />
            <TextareaField
              invalid={isInvalid(form, "caseIdentification.actsAndSections", submitAttempted)}
              label="Acts and sections"
              minRows={3}
              onChange={updateField}
              path="caseIdentification.actsAndSections"
              placeholder="Use fictional or placeholder references only. Do not enter real case details."
              value={form.caseIdentification.actsAndSections}
            />
            <InputField
              invalid={isInvalid(form, "caseIdentification.caseCategory", submitAttempted)}
              label="Case category"
              onChange={updateField}
              path="caseIdentification.caseCategory"
              placeholder="Property offence demonstration"
              value={form.caseIdentification.caseCategory}
            />
          </div>
        </IntakeSection>

        <IntakeSection eyebrow="Section 02" icon="activity" title="Occurrence details">
          <div className="case-form-grid compact">
            <InputField
              invalid={isInvalid(form, "occurrenceDetails.occurrenceDate", submitAttempted)}
              label="Occurrence date"
              onChange={updateField}
              path="occurrenceDetails.occurrenceDate"
              type="date"
              value={form.occurrenceDetails.occurrenceDate}
            />
            <InputField
              invalid={isInvalid(form, "occurrenceDetails.occurrenceTime", submitAttempted)}
              label="Occurrence time"
              onChange={updateField}
              path="occurrenceDetails.occurrenceTime"
              type="time"
              value={form.occurrenceDetails.occurrenceTime}
            />
            <InputField
              invalid={isInvalid(form, "occurrenceDetails.place", submitAttempted)}
              label="Place"
              onChange={updateField}
              path="occurrenceDetails.place"
              placeholder="Fictional municipal storage shed"
              value={form.occurrenceDetails.place}
            />
            <InputField
              invalid={isInvalid(form, "occurrenceDetails.distanceDirectionFromPoliceStation", submitAttempted)}
              label="Distance/direction from police station"
              onChange={updateField}
              path="occurrenceDetails.distanceDirectionFromPoliceStation"
              placeholder="Approx. 2 km east of fictional PS"
              value={form.occurrenceDetails.distanceDirectionFromPoliceStation}
            />
            <TextareaField
              invalid={isInvalid(form, "occurrenceDetails.address", submitAttempted)}
              label="Address"
              minRows={3}
              onChange={updateField}
              path="occurrenceDetails.address"
              placeholder="Use fictional location text only. Do not enter real addresses."
              value={form.occurrenceDetails.address}
            />
            <InputField
              invalid={isInvalid(form, "occurrenceDetails.informationReceivedDateTime", submitAttempted)}
              label="Information received date/time"
              onChange={updateField}
              path="occurrenceDetails.informationReceivedDateTime"
              placeholder="2026-07-31 08:35"
              value={form.occurrenceDetails.informationReceivedDateTime}
            />
            <InputField
              invalid={isInvalid(form, "occurrenceDetails.generalDiaryReference", submitAttempted)}
              label="General diary reference"
              onChange={updateField}
              path="occurrenceDetails.generalDiaryReference"
              placeholder="Fictional GD entry GD-082/2026"
              value={form.occurrenceDetails.generalDiaryReference}
            />
          </div>
        </IntakeSection>

        <IntakeSection eyebrow="Section 03" icon="clipboard" title="Case narrative">
          <div className="case-form-grid">
            <TextareaField
              invalid={isInvalid(form, "caseNarrative.incidentSummary", submitAttempted)}
              label="Incident summary"
              minRows={5}
              onChange={updateField}
              path="caseNarrative.incidentSummary"
              placeholder="Short fictional summary of what was reported."
              value={form.caseNarrative.incidentSummary}
              wide
            />
            <TextareaField
              invalid={isInvalid(form, "caseNarrative.detailedCaseContents", submitAttempted)}
              label="Detailed case contents"
              minRows={8}
              onChange={updateField}
              path="caseNarrative.detailedCaseContents"
              placeholder="Longer fictional narrative, observations, sequence, and unresolved issues."
              value={form.caseNarrative.detailedCaseContents}
              wide
            />
            <TextareaField
              label="Optional reason for delay in reporting"
              minRows={3}
              onChange={updateField}
              path="caseNarrative.delayReason"
              placeholder="Optional fictional delay explanation."
              value={form.caseNarrative.delayReason || ""}
              wide
            />
          </div>
        </IntakeSection>

        <IntakeSection eyebrow="Section 04" icon="user" title="People">
          <div className="case-form-grid">
            <TextareaField
              invalid={isInvalid(form, "people.complainantInformantSummary", submitAttempted)}
              label="Fictional complainant/informant summary"
              minRows={4}
              onChange={updateField}
              path="people.complainantInformantSummary"
              placeholder="Use summaries only. Do not enter real names, phone numbers, Aadhaar numbers, passports, addresses, or other identifiers."
              value={form.people.complainantInformantSummary}
            />
            <TextareaField
              invalid={isInvalid(form, "people.personDetails", submitAttempted)}
              label="Known/suspected/unknown person details"
              minRows={4}
              onChange={updateField}
              path="people.personDetails"
              placeholder="Use fictional descriptors only. Do not enter real identity details."
              value={form.people.personDetails}
            />
          </div>

          <div className="witness-section">
            <div className="subsection-header">
              <div>
                <span>Dynamic array</span>
                <strong>Witness statements</strong>
              </div>
              <button className="app-link-button subtle" type="button" onClick={addWitness}>
                <Icon name="plus" />
                Add another witness
              </button>
            </div>
            <div className="witness-card-grid">
              {form.people.witnesses.map((witness, index) => (
                <WitnessCard
                  canRemove={form.people.witnesses.length > 2}
                  index={index}
                  invalid={submitAttempted && index < 2 && !witness.statement.trim()}
                  key={witness.id}
                  onRemove={removeWitness}
                  onUpdate={updateWitness}
                  witness={witness}
                />
              ))}
            </div>
          </div>
        </IntakeSection>

        <IntakeSection eyebrow="Section 05" icon="layers" title="Evidence">
          <div className="case-form-grid">
            <TextareaField
              invalid={isInvalid(form, "evidence.physicalEvidence", submitAttempted)}
              label="Physical evidence"
              onChange={updateField}
              path="evidence.physicalEvidence"
              placeholder="Fictional physical items, condition, and officer notes."
              value={form.evidence.physicalEvidence}
            />
            <TextareaField
              invalid={isInvalid(form, "evidence.digitalEvidence", submitAttempted)}
              label="Digital evidence"
              onChange={updateField}
              path="evidence.digitalEvidence"
              placeholder="Fictional digital sources only. Do not enter real device identifiers."
              value={form.evidence.digitalEvidence}
            />
            <TextareaField
              invalid={isInvalid(form, "evidence.propertyInvolved", submitAttempted)}
              label="Property involved"
              onChange={updateField}
              path="evidence.propertyInvolved"
              placeholder="Fictional property notes."
              value={form.evidence.propertyInvolved}
            />
            <TextareaField
              invalid={isInvalid(form, "evidence.investigationUpdates", submitAttempted)}
              label="Investigation updates"
              onChange={updateField}
              path="evidence.investigationUpdates"
              placeholder="Fictional progress notes and unresolved tasks."
              value={form.evidence.investigationUpdates}
            />
            <TextareaField
              invalid={isInvalid(form, "evidence.chainOfCustodyNotes", submitAttempted)}
              label="Chain-of-custody notes"
              onChange={updateField}
              path="evidence.chainOfCustodyNotes"
              placeholder="Fictional custody, transfer, and receipt notes."
              value={form.evidence.chainOfCustodyNotes}
            />
            <TextareaField
              invalid={isInvalid(form, "evidence.forensicRequestDetails", submitAttempted)}
              label="Forensic request details"
              onChange={updateField}
              path="evidence.forensicRequestDetails"
              placeholder="Fictional forensic request and examination questions."
              value={form.evidence.forensicRequestDetails}
            />
          </div>

          <div className="electronic-evidence-section">
            <div className="subsection-header">
              <div>
                <span>Optional records</span>
                <strong>Electronic evidence metadata</strong>
              </div>
              <button className="app-link-button subtle" type="button" onClick={addElectronicEvidenceRecord}>
                <Icon name="plus" />
                Add electronic record
              </button>
            </div>

            {form.evidence.electronicEvidenceRecords.length ? (
              <div className="electronic-evidence-grid">
                {form.evidence.electronicEvidenceRecords.map((record, index) => (
                  <ElectronicEvidenceCard
                    index={index}
                    key={record.id}
                    onRemove={removeElectronicEvidenceRecord}
                    onUpdate={updateElectronicEvidenceRecord}
                    record={record}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-optional-note">
                No electronic evidence record added. Add only fictional metadata, never real device identifiers or real evidence details.
              </p>
            )}
          </div>
        </IntakeSection>
      </section>

      <aside className="case-form-sidebar">
        <section className="dashboard-card">
          <div className="dashboard-card-header compact-header">
            <div>
              <p>Preparation</p>
              <h3>{isComplete ? "Ready for analysis" : "Complete required groups"}</h3>
            </div>
            <Icon name="shield" />
          </div>
          <div className="case-prep-panel">
            <div
              className="case-prep-meter"
              style={
                {
                  "--progress": `${Math.min((completedRequired / totalRequired) * 100, 100)}%`,
                } as CSSProperties
              }
            >
              <span>
                Required fields
                <strong>
                  {Math.min(completedRequired, totalRequired)}/{totalRequired}
                </strong>
              </span>
              <i>
                <b />
              </i>
            </div>

            <ul className="case-checklist">
              <li className={hasCaseIdentity ? "is-complete" : undefined}>
                <Icon name="check" />
                Fictional case identity
              </li>
              <li className={hasOccurrenceAndGd ? "is-complete" : undefined}>
                <Icon name="check" />
                Occurrence and GD details
              </li>
              <li className={hasNarrative ? "is-complete" : undefined}>
                <Icon name="check" />
                Case narrative
              </li>
              <li className={hasTwoWitnessStatements ? "is-complete" : undefined}>
                <Icon name="check" />
                Two witness statements
              </li>
              <li className={hasEvidenceAndForensics ? "is-complete" : undefined}>
                <Icon name="check" />
                Evidence and forensics
              </li>
            </ul>

            {missingGroups.length ? (
              <div className="case-form-error" role="status">
                Missing required groups: {missingGroups.join(", ")}
              </div>
            ) : null}

            {submitAttempted && !isComplete ? (
              <p className="case-form-error" role="alert">
                Complete all required fictional fields and at least two witness statements before analysis.
              </p>
            ) : null}

            {submitError ? (
              <p className="case-form-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <button className="button button-primary case-submit-button" type="submit" disabled={isSubmitting || !isComplete}>
              <Icon name="activity" />
              {isSubmitting ? "Creating case" : "Create case and open analysis"}
            </button>

            <p className="case-form-note">
              This is not an FIR or official police record. Do not enter real names, Aadhaar numbers, phone numbers, passports, addresses, or live case information.
            </p>
          </div>
        </section>
      </aside>
    </form>
  );
}

function IntakeNotice() {
  return (
    <div className="intake-safety-notice" role="note">
      <Icon name="alert" />
      <div>
        <strong>Fictional demonstration intake only</strong>
        <p>
          This screen is police-record-inspired for product prototyping. It is not an official FIR, case diary, final report, charge sheet, or government record.
        </p>
      </div>
    </div>
  );
}

function IntakeSection({
  action,
  children,
  eyebrow,
  icon,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  icon: "activity" | "clipboard" | "file" | "layers" | "user";
  title: string;
}) {
  return (
    <section className="dashboard-card case-form-card">
      <div className="dashboard-card-header chart-card-header">
        <div>
          <p>{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {action || <Icon name={icon} />}
      </div>
      {children}
    </section>
  );
}

function WitnessCard({
  canRemove,
  index,
  invalid,
  onRemove,
  onUpdate,
  witness,
}: {
  canRemove: boolean;
  index: number;
  invalid: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof Omit<WitnessStatementInput, "id">, value: string) => void;
  witness: WitnessStatementInput;
}) {
  return (
    <article className="witness-card">
      <div className="witness-card-header">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <button
          aria-label={`Remove witness ${index + 1}`}
          className="icon-text-button danger"
          disabled={!canRemove}
          onClick={() => onRemove(witness.id)}
          type="button"
        >
          Remove
        </button>
      </div>
      <div className="case-form-grid compact">
        <label className="case-field">
          <span>Witness label</span>
          <input
            onChange={(event) => onUpdate(witness.id, "label", event.target.value)}
            placeholder={`Witness ${index + 1}`}
            type="text"
            value={witness.label}
          />
        </label>
        <label className="case-field">
          <span>Date/time mentioned</span>
          <input
            onChange={(event) => onUpdate(witness.id, "mentionedDateTime", event.target.value)}
            placeholder="Fictional date/time reference"
            type="text"
            value={witness.mentionedDateTime}
          />
        </label>
        <label className="case-field case-field-wide">
          <span>Location mentioned</span>
          <input
            onChange={(event) => onUpdate(witness.id, "mentionedLocation", event.target.value)}
            placeholder="Fictional location reference only"
            type="text"
            value={witness.mentionedLocation}
          />
        </label>
        <label className="case-field case-field-wide">
          <span>Statement</span>
          <textarea
            aria-invalid={invalid}
            onChange={(event) => onUpdate(witness.id, "statement", event.target.value)}
            placeholder="Fictional witness statement. Do not enter real names, identifiers, contact details, or live case information."
            rows={5}
            value={witness.statement}
          />
        </label>
        <label className="case-field case-field-wide">
          <span>Source notes</span>
          <textarea
            onChange={(event) => onUpdate(witness.id, "sourceNotes", event.target.value)}
            placeholder="Fictional source note, e.g. officer summary, station note, or demo transcription."
            rows={3}
            value={witness.sourceNotes}
          />
        </label>
      </div>
    </article>
  );
}

function ElectronicEvidenceCard({
  index,
  onRemove,
  onUpdate,
  record,
}: {
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof Omit<ElectronicEvidenceRecord, "id">, value: string) => void;
  record: ElectronicEvidenceRecord;
}) {
  return (
    <article className="electronic-evidence-card">
      <div className="witness-card-header">
        <span>Record {String(index + 1).padStart(2, "0")}</span>
        <button className="icon-text-button danger" onClick={() => onRemove(record.id)} type="button">
          Remove
        </button>
      </div>
      <div className="case-form-grid compact">
        <EvidenceInput
          field="sourceDeviceType"
          label="Source/device type"
          onUpdate={onUpdate}
          placeholder="Fictional CCTV export"
          record={record}
        />
        <EvidenceInput
          field="makeModel"
          label="Make/model"
          onUpdate={onUpdate}
          placeholder="DemoCam DC-200"
          record={record}
        />
        <EvidenceInput
          field="exhibitSerialNumber"
          label="Exhibit or serial number"
          onUpdate={onUpdate}
          placeholder="CF-2184-DV-01"
          record={record}
        />
        <EvidenceInput
          field="collectionDateTime"
          label="Collection date/time"
          onUpdate={onUpdate}
          placeholder="2026-07-31 09:25"
          record={record}
        />
        <EvidenceInput
          field="hashAlgorithm"
          label="Hash algorithm"
          onUpdate={onUpdate}
          placeholder="SHA-256"
          record={record}
        />
        <EvidenceInput
          field="hashValue"
          label="Hash value"
          onUpdate={onUpdate}
          placeholder="fictional-hash-value-only"
          record={record}
        />
        <label className="case-field case-field-wide">
          <span>Chain-of-custody status</span>
          <textarea
            onChange={(event) => onUpdate(record.id, "chainOfCustodyStatus", event.target.value)}
            placeholder="Fictional custody status only."
            rows={3}
            value={record.chainOfCustodyStatus}
          />
        </label>
      </div>
    </article>
  );
}

function EvidenceInput({
  field,
  label,
  onUpdate,
  placeholder,
  record,
}: {
  field: keyof Omit<ElectronicEvidenceRecord, "id">;
  label: string;
  onUpdate: (id: string, field: keyof Omit<ElectronicEvidenceRecord, "id">, value: string) => void;
  placeholder: string;
  record: ElectronicEvidenceRecord;
}) {
  return (
    <label className="case-field">
      <span>{label}</span>
      <input
        onChange={(event) => onUpdate(record.id, field, event.target.value)}
        placeholder={placeholder}
        type="text"
        value={record[field]}
      />
    </label>
  );
}

function InputField({
  invalid = false,
  label,
  onChange,
  path,
  placeholder,
  type = "text",
  value,
}: {
  invalid?: boolean;
  label: string;
  onChange: (path: TextFieldPath, value: string) => void;
  path: TextFieldPath;
  placeholder?: string;
  type?: "date" | "number" | "text" | "time";
  value: string;
}) {
  return (
    <label className="case-field">
      <span>{label}</span>
      <input
        aria-invalid={invalid}
        onChange={(event) => onChange(path, event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextareaField({
  invalid = false,
  label,
  minRows = 5,
  onChange,
  path,
  placeholder,
  value,
  wide = false,
}: {
  invalid?: boolean;
  label: string;
  minRows?: number;
  onChange: (path: TextFieldPath, value: string) => void;
  path: TextFieldPath;
  placeholder: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className={`case-field ${wide ? "case-field-wide" : ""}`}>
      <span>{label}</span>
      <textarea
        aria-invalid={invalid}
        onChange={(event) => onChange(path, event.target.value)}
        placeholder={placeholder}
        rows={minRows}
        value={value}
      />
    </label>
  );
}

function getTextField(form: CaseFormState, path: TextFieldPath) {
  const [group, field] = path.split(".") as [keyof CaseFormState, string];
  const record = form[group] as Record<string, unknown>;
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function setTextField(form: CaseFormState, path: TextFieldPath, value: string): CaseFormState {
  const [group, field] = path.split(".") as [keyof CaseFormState, string];

  return {
    ...form,
    [group]: {
      ...(form[group] as Record<string, unknown>),
      [field]: value,
    },
  } as CaseFormState;
}

function isInvalid(form: CaseFormState, path: TextFieldPath, submitAttempted: boolean) {
  return submitAttempted && requiredFieldPaths.includes(path) && !getTextField(form, path).trim();
}
