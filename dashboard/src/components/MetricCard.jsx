function MetricIcon({ name }) {
  if (name === "cpu") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
      </svg>
    );
  }

  if (name === "memory") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="3" />
        <path d="M8 10h8M8 14h4" />
      </svg>
    );
  }

  if (name === "disk") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8.5A3.5 3.5 0 0 1 8.5 5h7A3.5 3.5 0 0 1 19 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 5 15.5z" />
        <path d="M7.5 10.5h9M10 14.5h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export default function MetricCard({ title, value, unit, icon, accent, detail = null }) {
  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${accent}`}>
        <MetricIcon name={icon} />
      </div>
      <div className="metric-card__content">
        <p className="metric-card__title">{title}</p>
        <div className="metric-card__reading">
          <h3 className="metric-card__value">
            {value}
            {unit ? <span>{unit}</span> : null}
          </h3>
          {detail ? <p className="metric-card__detail">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}
