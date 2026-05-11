import { useEffect, useMemo, useState } from "react";

import { fetchHistory } from "../api.js";
import HistoryChart from "./HistoryChart.jsx";
import HistoryFilters from "./HistoryFilters.jsx";
import HistorySummaryCard from "./HistorySummaryCard.jsx";

const HISTORY_SERIES = [
  { key: "cpu_percent", label: "CPU Usage", color: "#ef4444", dotClassName: "chart-legend__dot--red" },
  { key: "memory_used_percent", label: "RAM Usage", color: "#3b82f6", dotClassName: "chart-legend__dot--blue" },
  { key: "disk_used_percent", label: "Disk Usage", color: "#8b5cf6", dotClassName: "chart-legend__dot--violet" },
];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPresetWindow(preset) {
  const endDate = new Date();
  const startDate = new Date(endDate);

  if (preset === "24h") {
    startDate.setDate(startDate.getDate() - 1);
  } else if (preset === "30d") {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    startDate.setDate(startDate.getDate() - 6);
  }

  return {
    start: formatDateInput(startDate),
    end: formatDateInput(endDate),
  };
}

function formatWindowLabel(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatRange(startDate, endDate);
}

function getSummaryCards(summary) {
  return [
    { label: "CPU Utilization", summary: summary?.cpu_percent, tone: "red" },
    { label: "Memory Pressure", summary: summary?.memory_used_percent, tone: "blue" },
    { label: "Disk Saturation", summary: summary?.disk_used_percent, tone: "violet" },
  ];
}

export default function HistoryView({ hostName }) {
  const defaultWindow = useMemo(() => buildPresetWindow("7d"), []);
  const [preset, setPreset] = useState("7d");
  const [start, setStart] = useState(defaultWindow.start);
  const [end, setEnd] = useState(defaultWindow.end);
  const [bucket, setBucket] = useState("auto");
  const [historyState, setHistoryState] = useState({
    bucket: "auto",
    loading: true,
    error: null,
    points: [],
    summary: null,
  });

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const payload = await fetchHistory({ start, end, bucket });

        if (!active) {
          return;
        }

        setHistoryState({
          bucket: payload.bucket ?? bucket,
          loading: false,
          error: null,
          points: payload.points ?? [],
          summary: payload.summary ?? null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setHistoryState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
      }
    }

    setHistoryState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));
    loadHistory();

    return () => {
      active = false;
    };
  }, [bucket, end, start]);

  function handlePresetSelect(nextPreset) {
    const window = buildPresetWindow(nextPreset);
    setPreset(nextPreset);
    setStart(window.start);
    setEnd(window.end);
  }

  function handleStartChange(value) {
    setPreset("custom");
    setStart(value);
  }

  function handleEndChange(value) {
    setPreset("custom");
    setEnd(value);
  }

  const rangeLabel = formatWindowLabel(start, end);
  const summaryCards = getSummaryCards(historyState.summary);

  return (
    <div className="history-view">
      <section className="history-intro">
        <div>
          <h2>Historical Analysis</h2>
          <p>
            Compare system behavior for <span>{hostName}</span> across specific date ranges, then switch between hourly and daily
            rollups when you want a tighter or broader read.
          </p>
        </div>
        <div className="history-intro__meta">
          <span>{rangeLabel}</span>
          <span>{historyState.points.length} samples</span>
          <span>{historyState.bucket} resolution</span>
        </div>
      </section>

      <HistoryFilters
        bucket={bucket}
        end={end}
        onBucketChange={setBucket}
        onEndChange={handleEndChange}
        onPresetSelect={handlePresetSelect}
        onStartChange={handleStartChange}
        preset={preset}
        start={start}
      />

      {historyState.error ? <p className="history-feedback history-feedback--error">Unable to load history: {historyState.error}</p> : null}
      {historyState.loading ? <p className="history-feedback">Loading history for the selected period...</p> : null}

      <section className="history-summary-grid" aria-label="Selected range summary">
        {summaryCards.map((card) => (
          <HistorySummaryCard key={card.label} label={card.label} summary={card.summary} tone={card.tone} />
        ))}
      </section>

      <HistoryChart
        id="history-view"
        title="Performance Trends"
        subtitle="CPU, RAM, and disk behavior across the selected analysis window."
        points={historyState.points}
        series={HISTORY_SERIES}
        height={280}
        emptyMessage="No historical samples were found for the chosen dates."
      />

      <section className="history-insights">
        <article className="data-panel">
          <div className="data-panel__header data-panel__header--stacked">
            <h2>Range Notes</h2>
            <p>Use hourly resolution for shorter investigations and daily rollups for broader trend reading.</p>
          </div>
          <ul className="history-notes">
            <li>Presets update both dates so users can move quickly between common review windows.</li>
            <li>Explicit start and end dates make the history view useful for audits, incident reviews, and weekly reports.</li>
            <li>The chart stays focused on utilization metrics already captured by the existing collector pipeline.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
