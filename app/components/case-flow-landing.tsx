"use client";

import type { CSSProperties, PointerEvent } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark";

type IconName =
  | "activity"
  | "arrow"
  | "bar"
  | "briefcase"
  | "check"
  | "chevron"
  | "clipboard"
  | "eye"
  | "file"
  | "filter"
  | "gap"
  | "layers"
  | "lock"
  | "moon"
  | "play"
  | "shield"
  | "sun"
  | "target"
  | "trend"
  | "users";

type ChartPoint = {
  label: string;
  value: number;
  category: string;
  detail: string;
};

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Privacy", href: "#privacy" },
  { label: "About", href: "#about" },
];

const heroStats = [
  { label: "Active cases", value: 126, delta: "+18 this week", icon: "briefcase" },
  { label: "Need attention", value: 14, delta: "4 critical", icon: "target" },
  { label: "Evidence readiness", value: 78, suffix: "%", delta: "+9%", icon: "check" },
  { label: "Forensic response", value: 9, delta: "awaiting", icon: "activity" },
] satisfies Array<{
  label: string;
  value: number;
  suffix?: string;
  delta: string;
  icon: IconName;
}>;

const trendPoints: ChartPoint[] = [
  { label: "Mon", value: 42, category: "Activity", detail: "Case notes organised" },
  { label: "Tue", value: 58, category: "Activity", detail: "Evidence uploads reviewed" },
  { label: "Wed", value: 52, category: "Activity", detail: "Contradictions checked" },
  { label: "Thu", value: 76, category: "Activity", detail: "Priority cases escalated" },
  { label: "Fri", value: 68, category: "Activity", detail: "Forensic replies logged" },
  { label: "Sat", value: 84, category: "Activity", detail: "Supervisor actions closed" },
  { label: "Sun", value: 97, category: "Activity", detail: "Weekly review prepared" },
];

const priorityCases = [
  { id: "CF-2047", label: "Evidence index mismatch", level: "High", tone: "danger" },
  { id: "CF-2031", label: "Witness timeline conflict", level: "Review", tone: "warning" },
  { id: "CF-1988", label: "Forensic note overdue", level: "Pending", tone: "purple" },
];

const workflowSteps = [
  {
    number: "01",
    title: "Organise Case Information",
    body: "Bring incident summaries, witness notes, evidence logs, and status updates into one structured case view.",
  },
  {
    number: "02",
    title: "Analyse Evidence and Contradictions",
    body: "Surface missing records, timeline conflicts, and unclear investigative dependencies for human review.",
  },
  {
    number: "03",
    title: "Track Action and Accountability",
    body: "Assign follow-up, monitor forensic readiness, and keep senior officers aligned on every pending decision.",
  },
];

const capabilities = [
  {
    icon: "layers",
    title: "Structured Case Intelligence",
    body: "Turn unstructured case material into clean summaries, linked records, readiness indicators, and review queues.",
  },
  {
    icon: "gap",
    title: "Contradiction and Evidence-Gap Analysis",
    body: "Highlight inconsistent timelines, missing exhibits, and unresolved statements before they slow the investigation.",
  },
  {
    icon: "target",
    title: "Investigation Action Tracking",
    body: "Track accountable next steps, due dates, forensic requests, escalations, and supervisory sign-off in one flow.",
  },
  {
    icon: "bar",
    title: "Senior Oversight and Reporting",
    body: "Give leadership a calm operational picture across workload, risk, readiness, and investigative momentum.",
  },
] satisfies Array<{ icon: IconName; title: string; body: string }>;

const impactMetrics = [
  { value: 184, label: "sample case records structured", suffix: "" },
  { value: 41, label: "sample evidence gaps surfaced", suffix: "" },
  { value: 87, label: "sample readiness index", suffix: "%" },
  { value: 26, label: "sample review hours prioritised", suffix: "h" },
];

const footerLinks = [
  { label: "Privacy", href: "#privacy" },
  { label: "Safety", href: "#safety" },
  { label: "Documentation", href: "#documentation" },
  { label: "Contact", href: "#contact" },
];

export function CaseFlowLanding() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useRevealOnScroll();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("caseflow-theme", theme);
  }, [theme]);

  return (
    <div className="caseflow-site" id="top">
      <SiteHeader
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <CapabilitiesSection />
        <ImpactSection />
        <AboutSection />
        <FinalCallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem("caseflow-theme") as Theme | null;
  return stored === "light" || stored === "dark" ? stored : "light";
}

function SiteHeader({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand-lockup" href="#top" aria-label="CaseFlow AI home">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="layers" />
          </span>
          <span>CaseFlow AI</span>
        </a>

        <nav className="header-nav" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <a className="text-link" href="#get-started">
            Sign In
          </a>
          <a className="button button-primary button-small" href="#get-started">
            Get Started
          </a>
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb">
                <Icon name={theme === "light" ? "moon" : "sun"} />
              </span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="hero-section section-grid-bg" id="product">
      <div className="section-shell hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-label">
            <span aria-hidden="true" />
            AI for Forensic Science and Public Safety
          </p>
          <h1>Turn scattered criminal case records into clear investigative action.</h1>
          <p className="hero-subtitle">
            CaseFlow AI helps investigation teams organise records, see evidence
            gaps, and track follow-up with the restraint required for public
            safety work.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#get-started">
              Get Started
              <Icon name="arrow" />
            </a>
            <a className="button button-secondary" href="#product-preview">
              <Icon name="play" />
              View Demo
            </a>
          </div>
          <p className="hero-disclaimer">Demonstration environment — fictional case data only.</p>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="preview-frame" id="product-preview" data-reveal>
      <div className="preview-card">
        <div className="preview-header">
          <div>
            <p className="preview-kicker">Overview</p>
            <h2>Command review</h2>
            <span>Last 7 days</span>
          </div>
          <div className="preview-controls" aria-hidden="true">
            <span>This week</span>
            <span>All units</span>
          </div>
        </div>

        <div className="preview-metrics">
          {heroStats.map((stat, index) => (
            <article
              className="preview-metric"
              key={stat.label}
              style={{ "--reveal-delay": `${index * 80}ms` } as CSSProperties}
              data-reveal
            >
              <div className="metric-icon" aria-hidden="true">
                <Icon name={stat.icon} />
              </div>
              <p>{stat.label}</p>
              <strong>
                <CountUp value={stat.value} suffix={stat.suffix} />
              </strong>
              <span>{stat.delta}</span>
            </article>
          ))}
        </div>

        <div className="preview-body">
          <article className="dashboard-panel trend-panel">
            <div className="panel-heading">
              <div>
                <h3>Investigation activity trend</h3>
                <p>Sample weekly movement</p>
              </div>
              <Icon name="trend" />
            </div>
            <TrendChart points={trendPoints} />
          </article>

          <article className="dashboard-panel readiness-panel">
            <div className="panel-heading">
              <div>
                <h3>Evidence readiness</h3>
                <p>Fictional distribution</p>
              </div>
              <span className="status-pill success">78%</span>
            </div>
            <DonutChart />
          </article>
        </div>

        <div className="preview-footer">
          <article className="dashboard-panel activity-panel">
            <div className="panel-heading">
              <h3>Awaiting forensic response</h3>
              <span className="status-pill warning">9 open</span>
            </div>
            <ul className="activity-list">
              <li>
                <span className="activity-dot green" />
                Ballistics request acknowledged
              </li>
              <li>
                <span className="activity-dot purple" />
                Toxicology timeline pending
              </li>
              <li>
                <span className="activity-dot amber" />
                Digital extract review queued
              </li>
            </ul>
          </article>

          <article className="dashboard-panel priority-panel">
            <div className="panel-heading">
              <h3>Priority cases</h3>
              <a href="#get-started">View all</a>
            </div>
            <ul>
              {priorityCases.map((item) => (
                <li key={item.id}>
                  <div>
                    <span>{item.id}</span>
                    <strong>{item.label}</strong>
                  </div>
                  <em className={`case-pill ${item.tone}`}>{item.level}</em>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section className="section-muted" id="how-it-works">
      <div className="section-shell">
        <SectionIntro
          eyebrow="How It Works"
          title="Three steps from record noise to investigative clarity"
          body="A focused workflow for teams that need structure, explainability, and oversight before action is taken."
        />

        <div className="steps-grid">
          {workflowSteps.map((step, index) => (
            <article
              className="step-card"
              key={step.number}
              data-reveal
              style={{ "--reveal-delay": `${index * 120}ms` } as CSSProperties}
            >
              <span className="step-number">{step.number}</span>
              <h3>
                {step.number} — {step.title}
              </h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section className="section-plain" id="capabilities">
      <div className="section-shell">
        <SectionIntro
          eyebrow="Core Capabilities"
          title="Everything a public safety review team needs in one place"
          body="Purpose-built surfaces for structured case intelligence, transparent review, and accountable follow-through."
        />

        <div className="capability-grid">
          {capabilities.map((capability, index) => (
            <article
              className="capability-card"
              key={capability.title}
              data-reveal
              style={{ "--reveal-delay": `${index * 100}ms` } as CSSProperties}
            >
              <div className="card-icon" aria-hidden="true">
                <Icon name={capability.icon} />
              </div>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImpactSection() {
  return (
    <section className="impact-section" id="impact">
      <div className="section-shell">
        <p className="eyebrow impact-eyebrow">Impact</p>
        <h2>Sample data that shows the intended operating picture</h2>
        <p className="impact-note">Demonstration environment — fictional case data only.</p>

        <div className="impact-grid">
          {impactMetrics.map((metric, index) => (
            <article
              className="impact-metric"
              key={metric.label}
              data-reveal
              style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
            >
              <strong>
                <CountUp value={metric.value} suffix={metric.suffix} />
              </strong>
              <span>{metric.label}</span>
              <em>sample data</em>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="section-plain about-section" id="about">
      <div className="section-shell about-grid">
        <div data-reveal>
          <p className="eyebrow">About</p>
          <h2>Built for careful review, not black-box decision making.</h2>
        </div>
        <div className="about-copy" data-reveal style={{ "--reveal-delay": "120ms" } as CSSProperties}>
          <p>
            CaseFlow AI is presented as a professional decision-support layer for
            forensic science and public safety teams. The landing page avoids
            live case handling, user accounts, and system integrations in this
            first build.
          </p>
          <div className="trust-row">
            <span id="privacy">
              <Icon name="lock" />
              Privacy-first positioning
            </span>
            <span id="safety">
              <Icon name="shield" />
              Human oversight emphasized
            </span>
            <span id="documentation">
              <Icon name="file" />
              Documentation-ready workflow
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCallToAction() {
  return (
    <section className="final-cta" id="get-started">
      <div className="section-shell final-cta-inner" data-reveal>
        <p className="eyebrow">Start With Structure</p>
        <h2>Move from scattered records to accountable next steps.</h2>
        <p>
          Preview a fictional CaseFlow AI environment designed for investigative
          clarity, evidence readiness, and senior oversight.
        </p>
        <div className="final-actions">
          <a className="button button-primary" href="#contact">
            Get Started
            <Icon name="arrow" />
          </a>
          <a className="button button-secondary" href="#product-preview">
            View Demo
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div className="section-shell footer-inner">
        <a className="footer-brand" href="#top" aria-label="CaseFlow AI home">
          <span className="footer-mark">C</span>
          <span>CaseFlow AI</span>
        </a>
        <nav aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <p>Demonstration environment — fictional case data only.</p>
      </div>
    </footer>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="section-intro" data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function TrendChart({ points }: { points: ChartPoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<(ChartPoint & { x: number; y: number }) | null>(null);

  const chart = useMemo(() => {
    const width = 520;
    const height = 210;
    const paddingX = 18;
    const paddingY = 22;
    const max = 110;
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;
    const positions = points.map((point, index) => {
      const x = paddingX + (index / (points.length - 1)) * innerWidth;
      const y = height - paddingY - (point.value / max) * innerHeight;
      return { ...point, x, y };
    });
    const line = positions
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L ${positions.at(-1)?.x ?? 0} ${height - paddingY} L ${positions[0]?.x ?? 0} ${
      height - paddingY
    } Z`;

    return { width, height, positions, line, area };
  }, [points]);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = (event.clientX - rect.left) / rect.width;
    const index = Math.max(
      0,
      Math.min(points.length - 1, Math.round(percent * (points.length - 1))),
    );
    setHovered(chart.positions[index]);
  }

  return (
    <div className="trend-chart" aria-label="Investigation activity trend chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
      >
        <title>Investigation activity trend</title>
        {[25, 55, 85].map((y) => (
          <line className="chart-gridline" key={y} x1="18" x2="502" y1={y} y2={y} />
        ))}
        <path className="chart-area" d={chart.area} />
        <path className="chart-line" d={chart.line} pathLength={1} />
        {chart.positions.map((point) => (
          <g key={point.label}>
            <circle className="chart-point-hit" cx={point.x} cy={point.y} r="16" />
            <circle className="chart-point" cx={point.x} cy={point.y} r="4.5" />
          </g>
        ))}
        <g className="chart-labels" aria-hidden="true">
          {chart.positions.map((point) => (
            <text key={point.label} x={point.x} y="201" textAnchor="middle">
              {point.label}
            </text>
          ))}
        </g>
      </svg>
      {hovered ? (
        <div
          className="chart-tooltip"
          style={
            {
              left: `${(hovered.x / chart.width) * 100}%`,
              top: `${(hovered.y / chart.height) * 100}%`,
            } as CSSProperties
          }
        >
          <strong>{hovered.category}</strong>
          <span>{hovered.value} actions</span>
          <em>{hovered.label}: {hovered.detail}</em>
        </div>
      ) : null}
    </div>
  );
}

function DonutChart() {
  const segments = [
    { label: "Ready", value: 42, color: "var(--accent)" },
    { label: "Review", value: 22, color: "var(--success)" },
    { label: "Pending", value: 20, color: "var(--warning)" },
    { label: "Blocked", value: 16, color: "var(--danger)" },
  ];
  let offset = 25;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" role="img" aria-label="Evidence readiness distribution">
        <title>Evidence readiness distribution</title>
        <circle className="donut-track" cx="60" cy="60" r="42" />
        {segments.map((segment) => {
          const dash = `${segment.value} ${100 - segment.value}`;
          const rotation = offset;
          offset += segment.value;
          return (
            <circle
              className="donut-segment"
              cx="60"
              cy="60"
              key={segment.label}
              r="42"
              stroke={segment.color}
              strokeDasharray={dash}
              strokeDashoffset={100 - rotation}
            />
          );
        })}
        <text x="60" y="57" textAnchor="middle">
          78%
        </text>
        <text x="60" y="74" textAnchor="middle">
          ready
        </text>
      </svg>
      <ul>
        {segments.map((segment) => (
          <li key={segment.label}>
            <span style={{ background: segment.color }} />
            {segment.label}
            <strong>{segment.value}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CountUp({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let hasRun = false;

    const run = () => {
      if (hasRun) return;
      hasRun = true;
      if (reduceMotion) {
        setDisplay(value);
        return;
      }
      const startedAt = performance.now();
      const duration = 900;

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(value * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) run();
      },
      { threshold: 0.35 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function useRevealOnScroll() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: IconName) {
  switch (name) {
    case "activity":
      return <path d="M3 12h4l2.2-6 4 12 2.3-6H21" />;
    case "arrow":
      return <path d="M5 12h14m-6-6 6 6-6 6" />;
    case "bar":
      return (
        <>
          <path d="M5 20V10" />
          <path d="M12 20V4" />
          <path d="M19 20v-7" />
        </>
      );
    case "briefcase":
      return (
        <>
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M4 11h16" />
        </>
      );
    case "check":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
    case "chevron":
      return <path d="m9 6 6 6-6 6" />;
    case "clipboard":
      return (
        <>
          <path d="M9 4h6l1 2h2v14H6V6h2z" />
          <path d="M9 10h6" />
          <path d="M9 14h5" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.7" />
        </>
      );
    case "file":
      return (
        <>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h4" />
          <path d="M9.5 13h5" />
          <path d="M9.5 17h5" />
        </>
      );
    case "filter":
      return <path d="M4 6h16M7 12h10M10 18h4" />;
    case "gap":
      return (
        <>
          <path d="M4 5h7v6H4z" />
          <path d="M13 5h7v6h-7z" />
          <path d="M4 13h7v6H4z" />
          <path d="M16.5 13v6" />
          <path d="M13.5 16h6" />
        </>
      );
    case "layers":
      return (
        <>
          <path d="m12 3 8 4.2-8 4.2-8-4.2z" />
          <path d="m4 12 8 4.2 8-4.2" />
          <path d="m4 16.5 8 4.2 8-4.2" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V8a4 4 0 0 1 8 0v2" />
        </>
      );
    case "moon":
      return <path d="M20 14.5A7.4 7.4 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />;
    case "play":
      return <path d="M8 5.5v13l10-6.5z" />;
    case "shield":
      return <path d="M12 3 5.5 5.7v5.5c0 4.2 2.7 7.9 6.5 9.2 3.8-1.3 6.5-5 6.5-9.2V5.7z" />;
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </>
      );
    case "trend":
      return <path d="m4 15 5-5 4 4 7-8M16 6h4v4" />;
    case "users":
      return (
        <>
          <path d="M16 20v-1.5c0-1.7-1.8-3-4-3s-4 1.3-4 3V20" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 19v-1c0-1.3-1.1-2.4-2.7-2.9" />
          <path d="M17 6.3a2.7 2.7 0 0 1 0 5.4" />
        </>
      );
    default:
      return <path d="M4 12h16" />;
  }
}
