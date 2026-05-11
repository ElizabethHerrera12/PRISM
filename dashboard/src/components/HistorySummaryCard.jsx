function formatPercent(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export default function HistorySummaryCard({ label, summary, tone }) {
  return (
    <article className={`history-summary-card history-summary-card--${tone}`}>
      <div className="history-summary-card__header">
        <h3>{label}</h3>
        <span>Selected Range</span>
      </div>

      <dl className="history-summary-card__metrics">
        <div>
          <dt>Average</dt>
          <dd>{formatPercent(summary?.average)}</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{formatPercent(summary?.max)}</dd>
        </div>
        <div>
          <dt>Low</dt>
          <dd>{formatPercent(summary?.min)}</dd>
        </div>
      </dl>
    </article>
  );
}
