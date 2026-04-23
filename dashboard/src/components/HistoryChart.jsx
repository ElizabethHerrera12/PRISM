const HEIGHT = 200;
const WIDTH = 620;
const MAX_VALUE = 100;

function buildPoints(data, accessor) {
  if (data.length === 0) {
    return "";
  }

  return data
    .map((entry, index) => {
      const x = data.length === 1 ? WIDTH / 2 : (index / (data.length - 1)) * WIDTH;
      const y = HEIGHT - (Number(entry[accessor] ?? 0) / MAX_VALUE) * HEIGHT;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function HistoryChart({ id, title, points, range, onRangeChange, rangeOptions }) {
  const cpuPoints = buildPoints(points, "cpu_percent");
  const ramPoints = buildPoints(points, "memory_used_percent");

  return (
    <section className="data-panel" id={id}>
      <div className="data-panel__header data-panel__header--chart">
        <h2>{title}</h2>
        <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="chart-shell">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="history-chart" role="img" aria-label={title}>
          <line x1="0" y1={HEIGHT * 0.25} x2={WIDTH} y2={HEIGHT * 0.25} stroke="#e5e7eb" strokeDasharray="4" />
          <line x1="0" y1={HEIGHT * 0.5} x2={WIDTH} y2={HEIGHT * 0.5} stroke="#e5e7eb" strokeDasharray="4" />
          <line x1="0" y1={HEIGHT * 0.75} x2={WIDTH} y2={HEIGHT * 0.75} stroke="#e5e7eb" strokeDasharray="4" />
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={ramPoints} />
          <polyline fill="none" stroke="#ef4444" strokeWidth="2.5" points={cpuPoints} />
        </svg>
      </div>

      <div className="chart-legend">
        <span>
          <i className="chart-legend__dot chart-legend__dot--red"></i>
          CPU Usage
        </span>
        <span>
          <i className="chart-legend__dot chart-legend__dot--blue"></i>
          RAM Usage
        </span>
      </div>
    </section>
  );
}
