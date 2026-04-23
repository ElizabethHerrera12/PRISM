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

export function fetchHistory(range = "1h") {
  return getJson(`/metrics/history?range=${encodeURIComponent(range)}`);
}

export function fetchTopProcesses(limit = 50) {
  return getJson(`/processes/top?limit=${encodeURIComponent(limit)}`);
}
