"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "./app-shell";

type StatusTone = "attention" | "forensics" | "ready" | "review" | "open" | "resolved" | "calm";
type MetricTone = "purple" | "danger" | "warning" | "success";
type ActivityTone = "green" | "purple" | "amber" | "red";

type TooltipPayload = {
  color?: string;
  name?: string;
  value?: number;
  payload?: { label?: string };
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
};

type MetricCardProps = {
  label: string;
  value: number;
  trend: string;
  comparison: string;
  tone: MetricTone;
  icon: "briefcase" | "alert" | "activity" | "check";
  sparkline: number[];
  direction: "up" | "down";
  delay?: number;
};

export type DashboardMetric = MetricCardProps;

export type PriorityCase = {
  id: string;
  caseReference: string;
  title: string;
  status: string;
  statusTone: StatusTone;
  priority: "High" | "Medium" | "Low";
  lastActivity: string;
  forensicStatus: string;
  readiness: number;
};

export type ActivityItem = {
  title: string;
  detail: string;
  time: string;
  tone: ActivityTone;
};

export type EvidenceProgressItem = {
  label: string;
  value: number | null;
  tone: "purple" | "success" | "warning";
};

export type ForensicQueueItem = {
  department: string;
  caseReference: string;
  status: string;
  wait: string;
  tone: StatusTone;
};

export type CaseProgressPoint = {
  label: string;
  opened: number;
  moved: number;
  resolved: number;
};

export type StatusDistributionItem = {
  label: string;
  value: number;
  color: string;
  count?: number;
  total?: number;
};

export const defaultMetricCards: DashboardMetric[] = [
  {
    label: "Assigned Cases",
    value: 18,
    trend: "+2 this week",
    comparison: "vs previous week",
    tone: "purple",
    icon: "briefcase",
    sparkline: [11, 12, 12, 14, 13, 16, 18],
    direction: "up",
  },
  {
    label: "Cases Requiring Attention",
    value: 5,
    trend: "-1 this week",
    comparison: "fewer than last period",
    tone: "danger",
    icon: "alert",
    sparkline: [8, 7, 6, 7, 6, 5, 5],
    direction: "down",
  },
  {
    label: "Awaiting Forensic Response",
    value: 4,
    trend: "+1 pending",
    comparison: "lab queue movement",
    tone: "warning",
    icon: "activity",
    sparkline: [2, 3, 3, 4, 3, 4, 4],
    direction: "up",
  },
  {
    label: "Cases Ready for Review",
    value: 9,
    trend: "+3 this week",
    comparison: "case packets prepared",
    tone: "success",
    icon: "check",
    sparkline: [4, 5, 6, 6, 7, 8, 9],
    direction: "up",
  },
];

export const defaultPriorityCases: PriorityCase[] = [
  {
    id: "CF-2047",
    caseReference: "CF-2047",
    title: "Harbor Warehouse Incident",
    status: "Needs Attention",
    statusTone: "attention",
    priority: "High",
    lastActivity: "Evidence checklist updated 12 min ago",
    forensicStatus: "Ballistics pending",
    readiness: 42,
  },
  {
    id: "CF-2016",
    caseReference: "CF-2016",
    title: "Riverside Assault Follow-up",
    status: "Officer Review",
    statusTone: "review",
    priority: "High",
    lastActivity: "Timeline contradiction flagged 2h ago",
    forensicStatus: "Medical report linked",
    readiness: 76,
  },
  {
    id: "CF-2039",
    caseReference: "CF-2039",
    title: "Cedar Avenue Robbery",
    status: "Awaiting Forensics",
    statusTone: "forensics",
    priority: "Medium",
    lastActivity: "Toxicology response requested 38 min ago",
    forensicStatus: "Toxicology requested",
    readiness: 58,
  },
  {
    id: "CF-2028",
    caseReference: "CF-2028",
    title: "Metro Station Evidence Review",
    status: "Ready for Review",
    statusTone: "ready",
    priority: "Medium",
    lastActivity: "Digital extract prepared 1h ago",
    forensicStatus: "Digital extract prepared",
    readiness: 91,
  },
  {
    id: "CF-2004",
    caseReference: "CF-2004",
    title: "Market Lane Chain-Snatching",
    status: "Open",
    statusTone: "open",
    priority: "Low",
    lastActivity: "Witness notes linked 4h ago",
    forensicStatus: "No lab request",
    readiness: 64,
  },
];

export const defaultActivityItems: ActivityItem[] = [
  {
    title: "CF-2047 evidence checklist updated",
    detail: "Exhibit tags and recovery notes moved into officer verification.",
    time: "8 min ago",
    tone: "purple",
  },
  {
    title: "Forensic response requested for CF-2039",
    detail: "Toxicology request clock started for the linked case packet.",
    time: "25 min ago",
    tone: "amber",
  },
  {
    title: "CF-2028 packet prepared for review",
    detail: "Digital extract, witness notes, and preparation checklist aligned.",
    time: "1h ago",
    tone: "green",
  },
  {
    title: "Timeline contradiction flagged",
    detail: "Statement dates in CF-2016 need officer review before escalation.",
    time: "2h ago",
    tone: "red",
  },
];

const defaultEvidenceProgress: EvidenceProgressItem[] = [
  { label: "Case information indexed", value: 82, tone: "purple" },
  { label: "Witness statements linked", value: 68, tone: "success" },
  { label: "Forensic request completeness", value: 55, tone: "warning" },
  { label: "Chain-of-custody completeness", value: 74, tone: "success" },
];

const defaultForensicQueue: ForensicQueueItem[] = [
  {
    department: "Ballistics",
    caseReference: "CF-2047",
    status: "Comparison pending",
    wait: "2d 4h",
    tone: "attention",
  },
  {
    department: "Toxicology",
    caseReference: "CF-2039",
    status: "Lab intake queued",
    wait: "1d 8h",
    tone: "forensics",
  },
  {
    department: "Digital Forensics",
    caseReference: "CF-2028",
    status: "Device timeline review",
    wait: "18h",
    tone: "review",
  },
];

function useCountUp(value: number) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      const frame = window.requestAnimationFrame(() => setDisplay(value));
      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;
    const duration = 850;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return display;
}

function CountUpNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const display = useCountUp(value);
  return (
    <>
      {display.toLocaleString()}
      {suffix}
    </>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  comparison,
  tone,
  icon,
  sparkline,
  direction,
  delay = 0,
}: MetricCardProps) {
  return (
    <article
      className={`metric-card metric-${tone}`}
      style={{ "--app-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="metric-card-top">
        <span className="metric-icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <MiniSparkline values={sparkline} tone={tone} />
      </div>
      <p>{label}</p>
      <strong>
        <CountUpNumber value={value} />
      </strong>
      <span className={`metric-trend ${direction === "down" ? "is-down" : "is-up"}`}>
        {direction === "down" ? "↘" : "↗"} {trend}
        <em>{comparison}</em>
      </span>
    </article>
  );
}

export function MiniSparkline({ values, tone }: { values: number[]; tone: MetricTone }) {
  const path = useMemo(() => {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * 100;
        const y = 34 - ((value - min) / range) * 26;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg className={`mini-sparkline sparkline-${tone}`} viewBox="0 0 100 40" aria-hidden="true">
      <path className="mini-sparkline-base" d={`${path} L 100 40 L 0 40 Z`} />
      <path className="mini-sparkline-line" d={path} pathLength="1" />
    </svg>
  );
}

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="case-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={`${entry.name}-${entry.value}`} style={{ "--tooltip-color": entry.color } as CSSProperties}>
          {entry.name}: <em>{entry.value}</em>
        </span>
      ))}
    </div>
  );
}

export function CaseProgressChart({ data }: { data: CaseProgressPoint[] }) {
  if (!data.length) {
    return (
      <section className="dashboard-card progress-chart-card dashboard-span-8">
        <div className="dashboard-card-header chart-card-header">
          <div>
            <p>Case progress trend</p>
            <h3>Opened, advanced, and resolved cases</h3>
          </div>
        </div>
        <p className="case-detail-empty">No recent activity history is available for trend rendering.</p>
      </section>
    );
  }

  return (
    <section className="dashboard-card progress-chart-card dashboard-span-8">
      <div className="dashboard-card-header chart-card-header">
        <div>
          <p>Case progress trend</p>
          <h3>Opened, advanced, and resolved cases</h3>
        </div>
      </div>
      <div className="case-chart-shell">
        <ResponsiveContainer width="100%" height={292}>
          <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 2 }}>
            <defs>
              <linearGradient id="openedGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#5b55f6" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#5b55f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 8" vertical={false} />
            <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={12} />
            <YAxis axisLine={false} tickLine={false} tickMargin={8} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)" }} />
            <Area
              dataKey="opened"
              fill="url(#openedGradient)"
              isAnimationActive
              name="Opened"
              stroke="#5b55f6"
              strokeWidth={3}
              type="monotone"
            />
            <Line
              dataKey="moved"
              dot={false}
              isAnimationActive
              name="Moved forward"
              stroke="#19bd86"
              strokeWidth={3}
              type="monotone"
            />
            <Line
              dataKey="resolved"
              dot={false}
              isAnimationActive
              name="Resolved"
              stroke="#f59e0b"
              strokeWidth={3}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="chart-legend" aria-hidden="true">
          <span className="legend-purple">Opened</span>
          <span className="legend-green">Moved forward</span>
          <span className="legend-amber">Resolved</span>
        </div>
      </div>
    </section>
  );
}

export function ResolutionRateCard({
  resolvedCount,
  totalCount,
}: {
  resolvedCount: number;
  totalCount: number;
}) {
  if (!totalCount) {
    return (
      <section className="dashboard-card resolution-card dashboard-span-4">
        <div className="dashboard-card-header compact-header">
          <div>
            <p>Case resolution rate</p>
            <h3>Resolved assigned cases</h3>
          </div>
        </div>
        <p className="case-detail-empty">Resolution rate appears after assigned cases are available.</p>
      </section>
    );
  }

  const rate = Math.round((resolvedCount / totalCount) * 100);

  return (
    <section className="dashboard-card resolution-card dashboard-span-4">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Case resolution rate</p>
          <h3>Resolved assigned cases</h3>
        </div>
      </div>
      <div className="resolution-body">
        <div className="resolution-ring" style={{ "--rate": rate } as CSSProperties}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="ring-track" cx="60" cy="60" r="48" pathLength="100" />
            <circle className="ring-progress" cx="60" cy="60" r="48" pathLength="100" />
          </svg>
          <strong>
            <CountUpNumber value={rate} suffix="%" />
          </strong>
        </div>
        <div>
          <p>{`${resolvedCount} of ${totalCount} assigned cases resolved`}</p>
          <span className="positive-change">Current authorized case resolution status</span>
        </div>
      </div>
    </section>
  );
}

export function StatusDistributionChart({ items }: { items: StatusDistributionItem[] }) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const activeStatus = items.find((item) => item.label === hoveredLabel) ?? items[0] ?? null;

  if (!items.length || !activeStatus) {
    return (
      <section className="dashboard-card distribution-card dashboard-span-4">
        <div className="dashboard-card-header compact-header">
          <div>
            <p>Case status distribution</p>
            <h3>Assigned queue mix</h3>
          </div>
        </div>
        <p className="case-detail-empty">Status distribution appears when assigned-case statuses are available.</p>
      </section>
    );
  }

  const handleDonutPointerMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.sqrt(x * x + y * y);
    const outerHit = rect.width * 0.43;
    const innerHit = rect.width * 0.18;

    if (distance < innerHit || distance > outerHit) return;

    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    const percent = ((angle + 90 + 360) % 360) / 3.6;
    let running = 0;
    const nextStatus =
      items.find((item) => {
        running += item.value;
        return percent <= running;
      }) ?? items[0];

    setHoveredLabel(nextStatus.label);
  };

  const segments = items.reduce<Array<StatusDistributionItem & { start: number; end: number }>>(
    (accumulator, item) => {
      const start = accumulator.at(-1)?.end ?? 0;
      return [...accumulator, { ...item, start, end: start + item.value }];
    },
    [],
  );

  return (
    <section className="dashboard-card distribution-card dashboard-span-4">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Case status distribution</p>
          <h3>Assigned queue mix</h3>
        </div>
      </div>
      <div className="distribution-body">
        <div className="distribution-chart">
          <svg
            className="distribution-donut"
            onMouseLeave={() => setHoveredLabel(null)}
            onMouseMove={handleDonutPointerMove}
            viewBox="0 0 120 120"
            role="img"
            aria-label="Case status distribution"
          >
            <circle className="distribution-track" cx="60" cy="60" r="42" pathLength="100" />
            {segments.map((entry, index) => (
              <path
                aria-label={`${entry.label}: ${entry.value}%`}
                className={`distribution-segment ${activeStatus.label === entry.label ? "is-active" : ""}`}
                d={donutSegmentPath(entry.start, entry.end)}
                fill={entry.color}
                key={entry.label}
                onBlur={() => setHoveredLabel(null)}
                onFocus={() => setHoveredLabel(entry.label)}
                onMouseEnter={() => setHoveredLabel(entry.label)}
                role="button"
                style={{ "--app-delay": `${index * 80}ms` } as CSSProperties}
                tabIndex={0}
              />
            ))}
            <circle className="distribution-hole" cx="60" cy="60" r="30" />
            <text className="distribution-center-value" x="60" y="56">
              {typeof activeStatus.count === "number" && typeof activeStatus.total === "number"
                ? `${activeStatus.count}/${activeStatus.total}`
                : `${Math.round(activeStatus.value)}%`}
            </text>
            <text className="distribution-center-label" x="60" y="70">
              {activeStatus.label}
            </text>
          </svg>
        </div>
        <ul className="distribution-list">
          {items.map((item) => (
            <li
              className={activeStatus.label === item.label ? "is-active" : undefined}
              key={item.label}
              onMouseEnter={() => setHoveredLabel(item.label)}
              onMouseLeave={() => setHoveredLabel(null)}
            >
              <span style={{ "--dot-color": item.color } as CSSProperties} />
              {item.label}
              <strong>
                {typeof item.count === "number" && typeof item.total === "number"
                  ? item.count
                  : `${Math.round(item.value)}%`}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function polarPoint(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: 60 + radius * Math.cos(radians),
    y: 60 + radius * Math.sin(radians),
  };
}

function donutSegmentPath(startPercent: number, endPercent: number) {
  const outerRadius = 42;
  const innerRadius = 28;
  const gap = 0.8;
  const startAngle = startPercent * 3.6 + gap;
  const endAngle = endPercent * 3.6 - gap;
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polarPoint(outerRadius, startAngle);
  const outerEnd = polarPoint(outerRadius, endAngle);
  const innerEnd = polarPoint(innerRadius, endAngle);
  const innerStart = polarPoint(innerRadius, startAngle);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function PriorityCaseTable({ cases }: { cases: PriorityCase[] }) {
  return (
    <section className="dashboard-card priority-case-card dashboard-span-8">
      <div className="dashboard-card-header chart-card-header">
        <div>
          <p>Priority cases</p>
          <h3>Five cases needing the clearest next action</h3>
        </div>
        <Link className="app-link-button subtle" href="/cases">
          View all cases
          <Icon name="arrow" />
        </Link>
      </div>
      <div className="priority-table-wrap">
        {cases.length ? (
          <table className="priority-case-table">
            <caption>Priority case queue from authorized records.</caption>
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Last activity</th>
                <th>Evidence</th>
                <th>Forensics</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((record) => (
                <tr key={record.id}>
                  <td data-label="Case">
                    <Link href={`/cases/${record.id}`}>
                      <span>{record.caseReference}</span>
                      <strong>{record.title}</strong>
                    </Link>
                  </td>
                  <td data-label="Status">
                    <StatusBadge tone={record.statusTone}>{record.status}</StatusBadge>
                  </td>
                  <td data-label="Priority">
                    <span className={`priority-chip priority-${record.priority.toLowerCase()}`}>
                      {record.priority}
                    </span>
                  </td>
                  <td data-label="Last activity">{record.lastActivity}</td>
                  <td data-label="Evidence">
                    <div className="readiness-cell compact-readiness">
                      <span>
                        <i style={{ width: `${record.readiness}%` }} />
                      </span>
                      <strong>{record.readiness}%</strong>
                    </div>
                  </td>
                  <td data-label="Forensics">{record.forensicStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="case-detail-empty">No priority cases available.</p>
        )}
      </div>
    </section>
  );
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <section className="dashboard-card activity-timeline-card dashboard-span-8">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Investigation activity</p>
          <h3>Recent action movement</h3>
        </div>
        <Icon name="activity" />
      </div>
      <ol className="activity-timeline">
        {items.length ? items.map((item, index) => (
          <li
            className={`timeline-${item.tone}`}
            key={item.title}
            style={{ "--app-delay": `${index * 70}ms` } as CSSProperties}
          >
            <span className="timeline-dot" aria-hidden="true" />
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <time>{item.time}</time>
          </li>
        )) : <li className="timeline-purple"><div><strong>No recent activity available.</strong></div></li>}
      </ol>
    </section>
  );
}

export function EvidenceProgress() {
  const items = defaultEvidenceProgress;

  return <EvidenceProgressCard items={items} />;
}

export function EvidenceProgressCard({ items }: { items: EvidenceProgressItem[] }) {
  return (
    <section className="dashboard-card evidence-progress-card dashboard-span-4">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Case Preparation Status</p>
          <h3>Preparation completeness</h3>
        </div>
      </div>
      <div className="evidence-progress-list">
        {items.map((item, index) => (
          <div
            className={`evidence-progress-item progress-${item.tone}`}
            key={item.label}
            style={{ "--progress": `${item.value ?? 0}%`, "--app-delay": `${index * 80}ms` } as CSSProperties}
          >
            <span>
              {item.label}
              <strong>{item.value === null ? "Not available" : `${item.value}%`}</strong>
            </span>
            <i>
              <b />
            </i>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ForensicQueue() {
  return <ForensicQueueCard items={defaultForensicQueue} pendingCount={defaultForensicQueue.length} />;
}

export function ForensicQueueCard({
  items,
  pendingCount,
}: {
  items: ForensicQueueItem[];
  pendingCount: number;
}) {
  return (
    <section className="dashboard-card forensic-queue-card dashboard-span-4" id="forensic-queue">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Forensic queue</p>
          <h3>Forensic requests awaiting response</h3>
        </div>
        <StatusBadge tone="forensics">{pendingCount} pending</StatusBadge>
      </div>
      <div className="forensic-queue-list">
        {items.length ? items.map((item) => (
          <article key={`${item.department}-${item.caseReference}`}>
            <span className="queue-dept">{item.department}</span>
            <strong>{item.caseReference}</strong>
            <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
            <em>{item.wait} waiting</em>
          </article>
        )) : <article><strong>No pending forensic requests.</strong></article>}
      </div>
    </section>
  );
}

export function QuickActions() {
  return <QuickActionsPanel startAnalysisHref="/cases" />;
}

export function QuickActionsPanel({ startAnalysisHref }: { startAnalysisHref: string }) {
  const actions = [
    { label: "Create Case", href: "/cases/new", icon: "plus" as const },
    { label: "View Assigned Cases", href: "/cases", icon: "briefcase" as const },
    { label: "Start Case Analysis", href: startAnalysisHref, icon: "activity" as const },
    { label: "Review Forensic Requests", href: "/oversight", icon: "clipboard" as const },
  ];

  return (
    <section className="dashboard-card quick-actions-card dashboard-span-4">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Quick actions</p>
          <h3>Common officer workflows</h3>
        </div>
      </div>
      <div className="quick-actions-list">
        {actions.map((action, index) => (
          <Link
            href={action.href}
            key={action.label}
            style={{ "--app-delay": `${index * 65}ms` } as CSSProperties}
          >
            <Icon name={action.icon} />
            <span>{action.label}</span>
            <Icon name="arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export const caseRecords = defaultPriorityCases;
