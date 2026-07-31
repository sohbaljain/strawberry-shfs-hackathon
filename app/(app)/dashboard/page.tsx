"use client";

import Link from "next/link";
import { Icon, PageContainer } from "../../components/app-shell";
import {
  ActivityTimeline,
  CaseProgressChart,
  EvidenceProgress,
  ForensicQueue,
  MetricCard,
  PriorityCaseTable,
  QuickActions,
  ResolutionRateCard,
  StatusDistributionChart,
  activityItems,
  metricCards,
  priorityCases,
} from "../../components/dashboard-components";

export default function DashboardPage() {
  return (
    <PageContainer
      eyebrow="Officer operations"
      title="Investigating Officer Dashboard"
      description="Track assigned investigations, forensic waits, evidence readiness, and recent action movement from one workspace."
      actions={
        <Link className="button button-primary app-primary-action" href="/cases/new">
          <Icon name="plus" />
          Create Case
        </Link>
      }
    >
      <section className="dashboard-metric-grid" aria-label="Dashboard metrics">
        {metricCards.map((stat, index) => (
          <MetricCard
            comparison={stat.comparison}
            direction={stat.direction}
            icon={stat.icon}
            key={stat.label}
            label={stat.label}
            sparkline={stat.sparkline}
            trend={stat.trend}
            value={stat.value}
            tone={stat.tone}
            delay={index * 80}
          />
        ))}
      </section>

      <section className="dashboard-analytics-grid">
        <CaseProgressChart />
        <StatusDistributionChart />
        <ResolutionRateCard />
        <EvidenceProgress />
        <ForensicQueue />
        <PriorityCaseTable cases={priorityCases} />
        <ActivityTimeline items={activityItems} />
        <QuickActions />
      </section>
    </PageContainer>
  );
}
