import { useEffect, useState } from "react";

import { fetchHistory, fetchLatestMetrics, fetchTopProcesses } from "./api.js";
import HistoryChart from "./components/HistoryChart.jsx";
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

  if (name === "server") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect x="3" y="4" width="18" height="6" rx="2" />
        <rect x="3" y="14" width="18" height="6" rx="2" />
        <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
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
  { label: "Dashboard", href: "#overview", icon: "activity", active: true },
  { label: "Processes", href: "#processes", icon: "list" },
  { label: "Logs", href: "#history", icon: "server" },
  { label: "History", href: "#history", icon: "clock" },
];

export default function App() {
  const [range, setRange] = useState("1h");
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

  return (
    <div className="monitor-app">
      <aside className="monitor-sidebar">
        <div className="sidebar-brand">
          <Icon name="activity" className="sidebar-brand__icon" />
          <span>PRISM</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`sidebar-link ${item.active ? "sidebar-link--active" : ""}`}
            >
              <Icon name={item.icon} className="sidebar-link__icon" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main className="monitor-main">
        <header className="monitor-header" id="overview">
          <div>
            <h1>System Dashboard</h1>
            <p>
              Overview of host: <span>{hostName}</span>
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
            id="history"
            title={`Resource History (${RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Last Hour"})`}
            points={history}
            range={range}
            onRangeChange={setRange}
            rangeOptions={RANGE_OPTIONS}
          />

          <ProcessTable compact processes={processes} />
        </section>

        <section className="data-panel" id="processes">
          <div className="data-panel__header">
            <div>
              <h2>Process Details</h2>
              <p>
                Latest sample from {hostName}. Disk used: {formatGigabytes(snapshot?.disk_used_gb)} of {formatGigabytes(snapshot?.disk_total_gb)}.
              </p>
            </div>
          </div>
          <ProcessTable processes={processes} />
        </section>
      </main>
    </div>
  );
}
