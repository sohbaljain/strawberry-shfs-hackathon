"use client";

import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CASE_DRAFT_STORAGE_PREFIX,
  CASE_ASSISTANT_UNAVAILABLE_MESSAGE,
  CASE_REPORT_STORAGE_PREFIX,
  FICTIONAL_DATA_NOTICE,
  REPORT_WARNING,
  buildMockAnalysis,
  caseDisplayName,
  createClientId,
  sampleFictionalCase,
  validateAnalysisReport,
  validateCaseInput,
  type AnalyzeCaseResponse,
  type CaseAssistantResponse,
  type CaseChatMessage,
  type CaseIntelligenceReport,
  type FictionalCaseInput,
} from "../lib/caseflow-analysis";
import { Icon } from "./app-shell";
import { useLanguage } from "./language-provider";

type SendState = "idle" | "sending";

type ChatSession = {
  id: string;
  caseId: string;
  title: string;
  messages: CaseChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const maxStoredSessions = 20;
const maxStoredMessages = 50;
const historyMessagesForRequest = 12;
const sessionStoragePrefix = "caseflow:case-chat-sessions:";
const activeSessionStoragePrefix = "caseflow:active-case-chat:";
const newChatTitle = "New case chat";

const quickPrompts = [
  "What information is still missing?",
  "Explain the witness differences.",
  "Which evidence items require verification?",
  "What safe review steps should be considered?",
];

export function CaseAssistant({
  caseId,
  caseReference,
}: {
  analysisReport: CaseIntelligenceReport;
  caseId: string;
  caseInput: FictionalCaseInput;
  caseReference: string;
}) {
  const { t } = useLanguage();

  return (
    <Link
      className="case-assistant-route-card dashboard-card"
      data-testid="case-assistant-launcher"
      href={`/case-assistant/${encodeURIComponent(caseId)}`}
    >
      <span className="case-assistant-route-icon" aria-hidden="true">
        <Icon name="activity" />
      </span>
      <span>
        <strong>{t("caseAssistant")}</strong>
        <em>{t("cases.caseAssistantLaunch", { caseReference })}</em>
      </span>
      <Icon name="arrow" />
    </Link>
  );
}

export function CaseAssistantWorkspace({ caseId }: { caseId: string }) {
  const { language, t } = useLanguage();
  const [packet, setPacket] = useState(() => buildAssistantFallbackPacket(caseId));
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendingSessionId, setSendingSessionId] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const sessionStorageKey = useMemo(() => `${sessionStoragePrefix}${caseId}`, [caseId]);
  const activeSessionStorageKey = useMemo(
    () => `${activeSessionStoragePrefix}${caseId}`,
    [caseId],
  );
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [activeSessionId, sessions],
  );
  const messages = activeSession?.messages ?? [];
  const isSendingActiveSession =
    sendState === "sending" && Boolean(activeSession?.id) && sendingSessionId === activeSession.id;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPacket(buildAssistantPacket(caseId));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [caseId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsHydrated(false);

      const loadedSessions = readStoredSessions(sessionStorageKey, caseId);
      const savedActiveSessionId = readActiveSessionId(activeSessionStorageKey);
      const nextSessions = loadedSessions.length ? loadedSessions : [createSession(caseId)];
      const nextActiveSession =
        nextSessions.find((session) => session.id === savedActiveSessionId) ?? nextSessions[0];

      setSessions(nextSessions);
      setActiveSessionId(nextActiveSession.id);
      setDraft("");
      setError("");
      setSendState("idle");
      setSendingSessionId("");
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeSessionStorageKey, caseId, sessionStorageKey]);

  useEffect(() => {
    if (!isHydrated) return;

    writeStoredSessions(sessionStorageKey, sessions);

    if (activeSessionId) {
      window.localStorage.setItem(activeSessionStorageKey, activeSessionId);
    }
  }, [activeSessionId, activeSessionStorageKey, isHydrated, sessionStorageKey, sessions]);

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [activeSessionId]);

  useEffect(() => {
    if (!historyRef.current) return;

    historyRef.current.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeSessionId, messages.length, isSendingActiveSession]);

  const createNewChat = () => {
    const session = createSession(caseId);

    setSessions((current) => limitSessions([session, ...current], caseId));
    setActiveSessionId(session.id);
    setDraft("");
    setError("");
  };

  const renameSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;

    const nextTitle = window.prompt("Rename chat", session.title)?.trim();
    if (!nextTitle) return;

    setSessions((current) =>
      limitSessions(
        current.map((item) =>
          item.id === sessionId
            ? { ...item, title: nextTitle.slice(0, 70), updatedAt: new Date().toISOString() }
            : item,
        ),
        caseId,
      ),
    );
  };

  const deleteSession = (sessionId: string) => {
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      const nextSessions = remaining.length ? remaining : [createSession(caseId)];

      if (activeSessionId === sessionId) {
        setActiveSessionId(nextSessions[0].id);
      }

      return limitSessions(nextSessions, caseId);
    });
    setError("");
  };

  const activateSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setDraft("");
    setError("");
  };

  const sendMessage = async (content: string) => {
    const question = content.trim();
    if (!question || sendState === "sending") return;

    const session = activeSession ?? createSession(caseId);
    const sessionId = session.id;
    const userMessage = createMessage("user", question);
    const nextMessages = [...session.messages, userMessage].slice(-maxStoredMessages);
    const nextTitle =
      session.title === newChatTitle && session.messages.length === 0
        ? createSessionTitle(question)
        : session.title;

    setSessions((current) =>
      upsertSession(
        current,
        {
          ...session,
          title: nextTitle,
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
        },
        caseId,
      ),
    );
    setActiveSessionId(sessionId);
    setDraft("");
    setError("");
    setSendState("sending");
    setSendingSessionId(sessionId);

    try {
      const response = await fetch("/api/case-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          question,
          caseInput: packet.caseInput,
          analysisReport: packet.report,
          uiLanguage: language,
          history: nextMessages
            .slice(-historyMessagesForRequest)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !isAssistantResponse(data)) {
        throw new Error(CASE_ASSISTANT_UNAVAILABLE_MESSAGE);
      }

      const assistantMessage = createMessage("assistant", data.answer, data.sources);

      setSessions((current) => {
        const latestSession =
          current.find((item) => item.id === sessionId) ??
          ({
            ...session,
            title: nextTitle,
            messages: nextMessages,
          } satisfies ChatSession);

        return upsertSession(
          current,
          {
            ...latestSession,
            messages: [...latestSession.messages, assistantMessage].slice(-maxStoredMessages),
            updatedAt: new Date().toISOString(),
          },
          caseId,
        );
      });
    } catch {
      setError(CASE_ASSISTANT_UNAVAILABLE_MESSAGE);
    } finally {
      setSendState("idle");
      setSendingSessionId("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    void sendMessage(draft);
  };

  return (
    <section className="case-assistant-page-shell" aria-label="Case-specific chat workspace">
      <CaseChatSidebar
        activeSessionId={activeSession?.id ?? ""}
        onActivateSession={activateSession}
        onDeleteSession={deleteSession}
        onNewChat={createNewChat}
        onRenameSession={renameSession}
        sessions={sessions}
      />

      <section className="case-assistant-conversation" aria-labelledby="case-assistant-title">
        <header className="case-assistant-conversation-header">
          <div className="case-assistant-heading">
            <span className="report-source-pill">
              <Icon name={packet.source === "gemini" ? "activity" : "alert"} />
              {packet.source === "gemini"
                ? t("assistant.validatedGeminiReport")
                : t("assistant.mockFallbackContext")}
            </span>
            <h2 id="case-assistant-title">{t("caseAssistant")}</h2>
            <p>{packet.displayName}</p>
          </div>

          <div className="case-assistant-header-actions">
            <span className="case-assistant-fictional-badge">
              <Icon name="alert" />
              {FICTIONAL_DATA_NOTICE}
            </span>
            <Link className="app-link-button subtle" href={`/analysis/${encodeURIComponent(caseId)}`}>
              {t("backToReport")}
              <Icon name="arrow" />
            </Link>
          </div>

          <div className="case-assistant-header-warning" role="note">
            <Icon name="shield" />
            <span>{REPORT_WARNING}</span>
          </div>
        </header>

        <div className="case-assistant-thread" ref={historyRef}>
          {messages.length === 0 ? (
            <div className="case-assistant-empty">
              <Icon name="shield" />
              <p>{t("assistant.placeholder")}</p>
            </div>
          ) : (
            messages.map((message) => <AssistantMessage key={message.id} message={message} />)
          )}

          {isSendingActiveSession ? (
            <div className="case-assistant-message assistant">
              <div className="case-assistant-bubble assistant is-loading" aria-label="Assistant is responding">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>

        {messages.length === 0 ? (
          <div className="case-assistant-prompts" aria-label="Suggested questions">
            {quickPrompts.map((prompt) => (
              <button
                disabled={sendState === "sending"}
                key={prompt}
                onClick={() => void sendMessage(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="case-assistant-error" role="status">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        ) : null}

        <footer className="case-assistant-composer">
          <label className="sr-only" htmlFor="case-assistant-input">
            {t("assistant.askCasePrompt")}
          </label>
          <textarea
            id="case-assistant-input"
            data-testid="case-assistant-input"
            maxLength={700}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("assistant.askCasePrompt")}
            ref={inputRef}
            rows={3}
            value={draft}
          />
          <div>
            <span>{t("assistant.enterSendsHint")}</span>
            <button
              className="case-assistant-send"
              data-testid="case-assistant-send"
              disabled={!draft.trim() || sendState === "sending" || !activeSession}
              onClick={() => void sendMessage(draft)}
              type="button"
            >
              {sendState === "sending" ? t("assistant.sending") : t("assistant.send")}
              <Icon name="arrow" />
            </button>
          </div>
        </footer>
      </section>
    </section>
  );
}

function CaseChatSidebar({
  activeSessionId,
  onActivateSession,
  onDeleteSession,
  onNewChat,
  onRenameSession,
  sessions,
}: {
  activeSessionId: string;
  onActivateSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  onRenameSession: (sessionId: string) => void;
  sessions: ChatSession[];
}) {
  const { t } = useLanguage();

  return (
    <aside className="case-chat-history-sidebar" aria-label="Case chat history">
      <div className="case-chat-history-header">
        <div>
          <p>{t("assistant.localHistory")}</p>
          <h2>{t("assistant.caseChats")}</h2>
        </div>
        <button className="app-link-button" onClick={onNewChat} type="button">
          <Icon name="plus" />
          {t("newChat")}
        </button>
      </div>

      <div className="case-chat-session-list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;

          return (
            <article className={isActive ? "active" : undefined} key={session.id}>
              <button
                aria-current={isActive ? "page" : undefined}
                className="case-chat-session-main"
                onClick={() => onActivateSession(session.id)}
                type="button"
              >
                <strong>{session.title}</strong>
                <span>{formatSessionTime(session.updatedAt)}</span>
              </button>
              <div className="case-chat-session-actions">
                <button
                  aria-label={`${t("assistant.renamePrompt")} ${session.title}`}
                  onClick={() => onRenameSession(session.id)}
                  type="button"
                >
                  {t("common.rename")}
                </button>
                <button
                  aria-label={`${t("common.delete")} ${session.title}`}
                  onClick={() => onDeleteSession(session.id)}
                  type="button"
                >
                  {t("common.delete")}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="case-chat-storage-note">{t("assistant.chatStorageNote")}</p>
    </aside>
  );
}

function AssistantMessage({ message }: { message: CaseChatMessage }) {
  return (
    <article className={`case-assistant-message ${message.role}`}>
      <div className={`case-assistant-bubble ${message.role}`}>
        <p>{message.content}</p>
        {message.role === "assistant" && message.sources?.length ? (
          <div className="case-assistant-sources">
            {message.sources.map((source) => (
              <span key={source}>{source}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function createSession(caseId: string): ChatSession {
  const now = new Date().toISOString();

  return {
    id: createClientId("case-chat-session"),
    caseId,
    title: newChatTitle,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createMessage(
  role: CaseChatMessage["role"],
  content: string,
  sources?: string[],
): CaseChatMessage {
  return {
    id: createClientId(`case-chat-${role}`),
    role,
    content,
    createdAt: new Date().toISOString(),
    sources,
  };
}

function createSessionTitle(question: string) {
  const words = question
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");

  if (!words) return newChatTitle;
  return words.length > 48 ? `${words.slice(0, 45)}...` : words;
}

function readStoredSessions(storageKey: string, caseId: string): ChatSession[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return limitSessions(
      parsed
        .map((item) => parseStoredSession(item, caseId))
        .filter((session): session is ChatSession => Boolean(session)),
      caseId,
    );
  } catch {
    return [];
  }
}

function writeStoredSessions(storageKey: string, sessions: ChatSession[]) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(sessions.slice(0, maxStoredSessions)),
    );
  } catch {
    // Storage can fail in private browsing or quota-limited contexts.
  }
}

function readActiveSessionId(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function parseStoredSession(value: unknown, caseId: string): ChatSession | null {
  if (!isRecord(value)) return null;

  const id = asText(value.id);
  const storedCaseId = asText(value.caseId);
  const createdAt = asText(value.createdAt);
  const updatedAt = asText(value.updatedAt);
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map(parseStoredMessage)
        .filter((message): message is CaseChatMessage => Boolean(message))
        .slice(-maxStoredMessages)
    : [];

  if (!id || storedCaseId !== caseId || !createdAt || !updatedAt) return null;

  return {
    id,
    caseId,
    title: asText(value.title).slice(0, 70) || newChatTitle,
    messages,
    createdAt,
    updatedAt,
  };
}

function parseStoredMessage(value: unknown): CaseChatMessage | null {
  if (!isRecord(value)) return null;

  const role = value.role === "user" || value.role === "assistant" ? value.role : null;
  const content = asText(value.content);
  const createdAt = asText(value.createdAt);
  const sources = Array.isArray(value.sources)
    ? value.sources.filter((source): source is string => typeof source === "string").slice(0, 8)
    : undefined;

  if (!role || !content || !createdAt) return null;

  return {
    id: asText(value.id) || createClientId(`case-chat-${role}`),
    role,
    content,
    createdAt,
    sources,
  };
}

function limitSessions(sessions: ChatSession[], caseId: string) {
  const seen = new Set<string>();

  return sessions
    .filter((session) => session.caseId === caseId)
    .map((session) => ({
      ...session,
      messages: session.messages.slice(-maxStoredMessages),
    }))
    .filter((session) => {
      if (seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, maxStoredSessions);
}

function upsertSession(sessions: ChatSession[], nextSession: ChatSession, caseId: string) {
  const withoutCurrent = sessions.filter((session) => session.id !== nextSession.id);
  return limitSessions([nextSession, ...withoutCurrent], caseId);
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "Not saved yet";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function isAssistantResponse(value: unknown): value is CaseAssistantResponse {
  if (!isRecord(value)) return false;

  return (
    typeof value.answer === "string" &&
    Array.isArray(value.sources) &&
    Array.isArray(value.limitations) &&
    value.requiresHumanVerification === true
  );
}

function buildAssistantPacket(caseId: string) {
  const caseInput = readStoredDraft(caseId) || buildSampleInput(caseId);
  const storedReport = readStoredReport(caseId);
  const report = storedReport?.report || buildMockAnalysis(caseInput);

  return {
    caseInput,
    report,
    displayName: caseDisplayName(caseInput) || caseId,
    source: storedReport?.source || "mock-fallback",
  };
}

function buildAssistantFallbackPacket(caseId: string) {
  const caseInput = buildSampleInput(caseId);

  return {
    caseInput,
    report: buildMockAnalysis(caseInput),
    displayName: caseDisplayName(caseInput) || caseId,
    source: "mock-fallback",
  };
}

function readStoredDraft(caseId: string): FictionalCaseInput | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(`${CASE_DRAFT_STORAGE_PREFIX}${caseId}`);
    return raw ? validateCaseInput(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function readStoredReport(caseId: string): AnalyzeCaseResponse | null {
  if (typeof window === "undefined") return null;

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
      notice: typeof parsed.notice === "string" ? parsed.notice : "",
      warning: typeof parsed.warning === "string" ? parsed.warning : "",
      advisoryOutputLabel:
        typeof parsed.advisoryOutputLabel === "string" ? parsed.advisoryOutputLabel : "",
      model: typeof parsed.model === "string" ? parsed.model : undefined,
      message: typeof parsed.message === "string" ? parsed.message : undefined,
    };
  } catch {
    return null;
  }
}

function buildSampleInput(caseId: string): FictionalCaseInput {
  return {
    ...sampleFictionalCase,
    caseId,
    caseIdentification: {
      ...sampleFictionalCase.caseIdentification,
      fictionalCaseNumber: caseId,
    },
    createdAt: new Date().toISOString(),
  };
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
