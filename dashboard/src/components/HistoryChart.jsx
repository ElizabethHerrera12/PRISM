const DEFAULT_SERIES = [
  { key: "cpu_percent", label: "CPU Usage", color: "#ef4444", dotClassName: "chart-legend__dot--red" },
  { key: "memory_used_percent", label: "RAM Usage", color: "#3b82f6", dotClassName: "chart-legend__dot--blue" },
];

function buildLinePoints(data, accessor, width, height, maxValue) {
  if (data.length === 0) {
    return "";
  }

  return data
    .map((entry, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - (Number(entry[accessor] ?? 0) / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function createAxisTicks(points, width, height, maxTicks) {
  if (points.length === 0) {
    return [];
  }

  const step = Math.max(1, Math.ceil(points.length / maxTicks));
  const ticks = [];

  for (let index = 0; index < points.length; index += step) {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    ticks.push({
      x,
      label: formatAxisLabel(points[index].sampled_at),
    });
  }

  const lastIndex = points.length - 1;
  const lastX = points.length === 1 ? width / 2 : width;
  const lastLabel = formatAxisLabel(points[lastIndex].sampled_at);

  if (ticks[ticks.length - 1]?.label !== lastLabel) {
    ticks.push({ x: lastX, label: lastLabel });
  }

  return ticks;
}

function formatAxisLabel(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value ?? "");
  }

  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;

  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    ...(isMidnight ? {} : { hour: "numeric" }),
  }).format(date);
}

export default function HistoryChart({
  controls = null,
  emptyMessage = "No history data available for the selected period.",
  height = 240,
  id,
  points,
  series = DEFAULT_SERIES,
  subtitle = null,
  title,
}) {
  const width = 760;
  const chartHeight = Math.max(180, height);
  const gridLineValues = [25, 50, 75];
  const ticks = createAxisTicks(points, width, chartHeight, 5);

  return (
    <section className="data-panel" id={id}>
      <div className="data-panel__header data-panel__header--chart">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {controls}
      </div>

      <div className="chart-shell">
        {points.length === 0 ? (
          <div className="history-chart history-chart--empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${chartHeight + 32}`}
            className="history-chart"
            role="img"
            aria-label={title}
          >
            {gridLineValues.map((value) => {
              const y = chartHeight - (value / 100) * chartHeight;

              return (
                <g key={value}>
                  <line x1="0" y1={y} x2={width} y2={y} stroke="#e5e7eb" strokeDasharray="4" />
                  <text x="0" y={Math.max(12, y - 6)} fill="#9ca3af" fontSize="11" stroke="none">
                    {value}%
                  </text>
                </g>
              );
            })}

            {series.map((line) => (
              <polyline
                key={line.key}
                fill="none"
                stroke={line.color}
                strokeWidth="2.5"
                points={buildLinePoints(points, line.key, width, chartHeight, 100)}
              />
            ))}

            {ticks.map((tick) => (
              <text
                key={`${tick.x}-${tick.label}`}
                x={tick.x}
                y={chartHeight + 22}
                fill="#6b7280"
                fontSize="11"
                stroke="none"
                textAnchor={tick.x === 0 ? "start" : tick.x === width ? "end" : "middle"}
              >
                {tick.label}
              </text>
            ))}
          </svg>
        )}
      </div>

      <div className="chart-legend">
        {series.map((line) => (
          <span key={line.key}>
            <i className={`chart-legend__dot ${line.dotClassName}`}></i>
            {line.label}
          </span>
        ))}
      </div>
    </section>
  );
}
