const PRESET_OPTIONS = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

const BUCKET_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "hour", label: "Hourly" },
  { value: "day", label: "Daily" },
];

export default function HistoryFilters({
  bucket,
  end,
  onBucketChange,
  onEndChange,
  onPresetSelect,
  onStartChange,
  preset,
  start,
}) {
  return (
    <section className="history-filters" aria-label="History filters">
      <div className="history-filters__presets" role="group" aria-label="Quick presets">
        {PRESET_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`history-filter-chip ${preset === option.value ? "history-filter-chip--active" : ""}`}
            onClick={() => onPresetSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="history-filters__fields">
        <label className="history-filter-field">
          <span>Start Date</span>
          <input type="date" value={start} onChange={(event) => onStartChange(event.target.value)} />
        </label>

        <label className="history-filter-field">
          <span>End Date</span>
          <input type="date" value={end} onChange={(event) => onEndChange(event.target.value)} />
        </label>

        <label className="history-filter-field">
          <span>Resolution</span>
          <select value={bucket} onChange={(event) => onBucketChange(event.target.value)}>
            {BUCKET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
