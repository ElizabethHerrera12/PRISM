import { useEffect, useMemo, useState } from "react";

import { fetchHistory, fetchLatestMetrics, fetchTopProcesses } from "./api.js";
import HistoryChart from "./components/HistoryChart.jsx";
import HistoryView from "./components/HistoryView.jsx";
import MetricCard from "./components/MetricCard.jsx";
import ProcessTable from "./components/ProcessTable.jsx";

const REFRESH_MS = 5000;
const RANGE_OPTIONS = [
  { value: "1h", label: "Last Hour" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
];

function Icon({ name, className = "" }) {
  if (name === "activity") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M3 12h4l2.5-5 4 10 2.5-5H21" />
      </svg>
    );
  }

  if (name === "list") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4 12h16" />
    </svg>
  );
}

function formatPercent(value) {
  return Number(value ?? 0).toFixed(1);
}

function formatTime(date) {
  if (!date) {
    return "Waiting for data";
  }

  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatGigabytes(value) {
  return `${Number(value ?? 0).toFixed(1)} GB`;
}

function formatMegabytesAsGigabytes(value) {
  return `${(Number(value ?? 0) / 1024).toFixed(1)} GB`;
}

function formatMegahertz(value) {
  return Number(value ?? 0).toFixed(0);
}

function getAvatarLabel(hostName) {
  const parts = String(hostName ?? "PM")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "PM";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

const NAV_ITEMS = [
  { key: "overview", label: "Dashboard", icon: "activity" },
  { key: "processes", label: "Processes", icon: "list" },
  { key: "history", label: "History", icon: "clock" },
];

const VIEW_CONTENT = {
  overview: {
    title: "System Dashboard",
    description: "Live overview of the current host health and top resource consumers.",
  },
  processes: {
    title: "Process Details",
    description: "Inspect the latest sampled processes and sort them by CPU, memory, user, or PID.",
  },
  history: {
    title: "Performance History",
    description: "Review historical system trends across days or weeks with explicit date filtering.",
  },
};

export default function App() {
  const [activeView, setActiveView] = useState("overview");
  const [range, setRange] = useState("24h");
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null, refreshedAt: null });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [latestPayload, historyPayload, processPayload] = await Promise.all([
          fetchLatestMetrics(),
          fetchHistory(range),
          fetchTopProcesses(50),
        ]);

        if (!active) {
          return;
        }

        setLatest(latestPayload);
        setHistory(historyPayload.points ?? []);
        setProcesses(processPayload.processes ?? []);
        setStatus({ loading: false, error: null, refreshedAt: new Date() });
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus((current) => ({
          loading: false,
          error: error.message,
          refreshedAt: current.refreshedAt,
        }));
      }
    }

    load();
    const timer = window.setInterval(load, REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [range]);

  const snapshot = latest?.snapshot;
  const hostName = snapshot?.host_name ?? "unknown-host";
  const avatarLabel = getAvatarLabel(hostName);
  const page = VIEW_CONTENT[activeView];

  const overviewControls = useMemo(
    () => (
      <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Overview history range">
        {RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    [range],
  );

  return (
    <div className="monitor-app">
      <aside className="monitor-sidebar">
        <div className="sidebar-brand">
          <Icon name="activity" className="sidebar-brand__icon" />
          <span>PRISM</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-link ${item.key === activeView ? "sidebar-link--active" : ""}`}
              onClick={() => setActiveView(item.key)}
            >
              <Icon name={item.icon} className="sidebar-link__icon" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="monitor-main">
        <header className="monitor-header">
          <div>
            <h1>{page.title}</h1>
            <p>
              {page.description} <span>{hostName}</span>
            </p>
          </div>

          <div className="monitor-header__meta">
            <span className={`refresh-pill ${status.error ? "refresh-pill--error" : ""}`}>
              <svg viewBox="0 0 24 24" className="refresh-pill__icon" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v6h-6" />
              </svg>
              {status.error ? `Error: ${status.error}` : `Updated: ${formatTime(status.refreshedAt)}`}
            </span>
            <div className="avatar-circle">{avatarLabel}</div>
          </div>
        </header>

        {activeView === "overview" ? (
          <>
            <section className="metric-grid" aria-label="Key metrics">
              <MetricCard
                title="CPU Usage"
                value={formatPercent(snapshot?.cpu_percent)}
                unit="%"
                icon="cpu"
                accent="red"
              />
              <MetricCard
                title="RAM Usage"
                value={formatPercent(snapshot?.memory_used_percent)}
                unit="%"
                icon="memory"
                accent="blue"
                detail={`${formatMegabytesAsGigabytes(snapshot?.memory_used_mb)} / ${formatMegabytesAsGigabytes(snapshot?.memory_total_mb)}`}
              />
              <MetricCard
                title="Disk Usage"
                value={formatPercent(snapshot?.disk_used_percent)}
                unit="%"
                icon="disk"
                accent="violet"
              />
              <MetricCard
                title="CPU Clock"
                value={formatMegahertz(snapshot?.cpu_mhz)}
                unit="MHz"
                icon="clock"
                accent="green"
              />
            </section>

            <section className="dashboard-grid">
              <HistoryChart
                id="overview-history"
                title={`Resource History (${RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Last Hour"})`}
                subtitle="Keep an eye on the latest CPU and memory behavior without leaving the overview."
                points={history}
                controls={overviewControls}
              />

              <ProcessTable compact processes={processes} onViewAll={() => setActiveView("processes")} />
            </section>
          </>
        ) : null}

        {activeView === "processes" ? (
          <section className="data-panel">
            <div className="data-panel__header">
              <div>
                <h2>Process Details</h2>
                <p>
                  Latest sample from {hostName}. Disk used: {formatGigabytes(snapshot?.disk_used_gb)} of{" "}
                  {formatGigabytes(snapshot?.disk_total_gb)}.
                </p>
              </div>
            </div>
            <ProcessTable processes={processes} />
          </section>
        ) : null}

        {activeView === "history" ? <HistoryView hostName={hostName} /> : null}

        {status.loading ? <p className="history-feedback">Loading live system metrics...</p> : null}
      </main>
    </div>
  );
}
