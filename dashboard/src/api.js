const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? `Request failed for ${path}`);
  }

  return response.json();
}

export function fetchLatestMetrics() {
  return getJson("/metrics/latest");
}

export function fetchHistory(options = "1h") {
  if (typeof options === "string") {
    return getJson(`/metrics/history?range=${encodeURIComponent(options)}`);
  }

  const params = new URLSearchParams();

  if (options.range) {
    params.set("range", options.range);
  }

  if (options.start) {
    params.set("start", options.start);
  }

  if (options.end) {
    params.set("end", options.end);
  }

  if (options.bucket) {
    params.set("bucket", options.bucket);
  }

  return getJson(`/metrics/history?${params.toString()}`);
}

export function fetchTopProcesses(limit = 50) {
  return getJson(`/processes/top?limit=${encodeURIComponent(limit)}`);
}
