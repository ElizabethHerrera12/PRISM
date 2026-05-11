import os from "node:os";

import { pool } from "../db.js";

const HOST_NAME = process.env.PRISM_HOST_NAME ?? os.hostname();
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_BUCKETS = new Set(["raw", "hour", "day", "auto"]);

function rangeToStartDate(range) {
  const value = range ?? "1h";
  const match = /^(\d+)([mhd])$/.exec(value);

  if (!match) {
    throw new Error("Range must look like 30m, 1h, or 7d");
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();

  if (unit === "m") {
    now.setMinutes(now.getMinutes() - amount);
  } else if (unit === "h") {
    now.setHours(now.getHours() - amount);
  } else {
    now.setDate(now.getDate() - amount);
  }

  return now;
}

function parseDateInput(value, { endOfDay = false } = {}) {
  if (!value) {
    return null;
  }

  const normalized = DATE_ONLY_PATTERN.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`
    : value;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date;
}

function createHistoryWindow(options = {}) {
  const range = options.range?.toString();
  const startValue = options.start?.toString();
  const endValue = options.end?.toString();

  if (startValue || endValue) {
    if (!startValue || !endValue) {
      throw new Error("Both start and end must be provided together.");
    }

    const startDate = parseDateInput(startValue);
    const endDate = parseDateInput(endValue, { endOfDay: true });

    if (startDate > endDate) {
      throw new Error("Start date must be before end date.");
    }

    return {
      mode: "absolute",
      startDate,
      endDate,
      start: startValue,
      end: endValue,
    };
  }

  const startDate = rangeToStartDate(range ?? "1h");

  return {
    mode: "relative",
    startDate,
    endDate: new Date(),
    range: range ?? "1h",
  };
}

function resolveBucket(window, bucket) {
  const requestedBucket = bucket?.toString() ?? "auto";

  if (!VALID_BUCKETS.has(requestedBucket)) {
    throw new Error("Bucket must be one of auto, raw, hour, or day.");
  }

  if (requestedBucket !== "auto") {
    return requestedBucket;
  }

  const durationMs = window.endDate.getTime() - window.startDate.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  if (durationHours <= 48) {
    return "raw";
  }

  if (durationHours <= 24 * 14) {
    return "hour";
  }

  return "day";
}

function formatDateBoundary(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function buildHistoryPointQuery(bucket) {
  if (bucket === "raw") {
    return `
      SELECT
        cpu.\`dateTime\` AS sampled_at,
        ROUND((cpu.\`cpuMHz\` / NULLIF(cpu.\`cpuMHzMax\`, 0)) * 100, 2) AS cpu_percent,
        ROUND(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100, 2) AS memory_used_percent,
        disk_info.\`usePercent\` AS disk_used_percent
      FROM cpu
      INNER JOIN memory_info ON memory_info.\`dateTime\` = cpu.\`dateTime\`
      INNER JOIN disk_info ON disk_info.\`dateTime\` = cpu.\`dateTime\`
      WHERE cpu.\`dateTime\` BETWEEN ? AND ?
      ORDER BY cpu.\`dateTime\` ASC
    `;
  }

  const bucketFormat = bucket === "hour" ? "%Y-%m-%d %H:00:00" : "%Y-%m-%d 00:00:00";

  return `
    SELECT
      DATE_FORMAT(cpu.\`dateTime\`, '${bucketFormat}') AS sampled_at,
      ROUND(AVG((cpu.\`cpuMHz\` / NULLIF(cpu.\`cpuMHzMax\`, 0)) * 100), 2) AS cpu_percent,
      ROUND(AVG(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100), 2) AS memory_used_percent,
      ROUND(AVG(disk_info.\`usePercent\`), 2) AS disk_used_percent
    FROM cpu
    INNER JOIN memory_info ON memory_info.\`dateTime\` = cpu.\`dateTime\`
    INNER JOIN disk_info ON disk_info.\`dateTime\` = cpu.\`dateTime\`
    WHERE cpu.\`dateTime\` BETWEEN ? AND ?
    GROUP BY DATE_FORMAT(cpu.\`dateTime\`, '${bucketFormat}')
    ORDER BY sampled_at ASC
  `;
}

function buildSummaryPayload(row) {
  return {
    cpu_percent: {
      average: Number(row?.cpu_average_percent ?? 0),
      min: Number(row?.cpu_min_percent ?? 0),
      max: Number(row?.cpu_max_percent ?? 0),
    },
    memory_used_percent: {
      average: Number(row?.memory_average_percent ?? 0),
      min: Number(row?.memory_min_percent ?? 0),
      max: Number(row?.memory_max_percent ?? 0),
    },
    disk_used_percent: {
      average: Number(row?.disk_average_percent ?? 0),
      min: Number(row?.disk_min_percent ?? 0),
      max: Number(row?.disk_max_percent ?? 0),
    },
  };
}

function buildSnapshotSelect(alias = "") {
  const prefix = alias ? `${alias}.` : "";

  return `
    ${prefix}\`dateTime\` AS sampled_at,
    ROUND((${prefix}\`cpuMHz\` / NULLIF(${prefix}\`cpuMHzMax\`, 0)) * 100, 2) AS cpu_percent,
    ${prefix}\`cpuMHz\` AS cpu_mhz,
    ${prefix}\`cpuMHzMin\` AS cpu_mhz_min,
    ${prefix}\`cpuMHzMax\` AS cpu_mhz_max,
    memory_info.\`MemTotal\` AS memory_total_mb,
    memory_info.\`MemFree\` AS memory_free_mb,
    (memory_info.\`MemTotal\` - memory_info.\`MemFree\`) AS memory_used_mb,
    ROUND(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100, 2) AS memory_used_percent,
    disk_info.\`size\` AS disk_total_gb,
    disk_info.\`used\` AS disk_used_gb,
    disk_info.\`avail\` AS disk_available_gb,
    disk_info.\`usePercent\` AS disk_used_percent
  `;
}

function normalizeSnapshot(row) {
  if (!row) {
    return null;
  }

  return {
    host_name: HOST_NAME,
    sampled_at: row.sampled_at,
    cpu_percent: Number(row.cpu_percent ?? 0),
    cpu_mhz: Number(row.cpu_mhz ?? 0),
    cpu_mhz_min: Number(row.cpu_mhz_min ?? 0),
    cpu_mhz_max: Number(row.cpu_mhz_max ?? 0),
    memory_total_mb: Number(row.memory_total_mb ?? 0),
    memory_free_mb: Number(row.memory_free_mb ?? 0),
    memory_used_mb: Number(row.memory_used_mb ?? 0),
    memory_used_percent: Number(row.memory_used_percent ?? 0),
    disk_total_gb: Number(row.disk_total_gb ?? 0),
    disk_used_gb: Number(row.disk_used_gb ?? 0),
    disk_available_gb: Number(row.disk_available_gb ?? 0),
    disk_used_percent: Number(row.disk_used_percent ?? 0),
  };
}

export async function getLatestSnapshot() {
  const [rows] = await pool.query(
    `
      SELECT
        ${buildSnapshotSelect("cpu")}
      FROM cpu
      INNER JOIN memory_info ON memory_info.\`dateTime\` = cpu.\`dateTime\`
      INNER JOIN disk_info ON disk_info.\`dateTime\` = cpu.\`dateTime\`
      ORDER BY cpu.\`dateTime\` DESC
      LIMIT 1
    `,
  );

  return normalizeSnapshot(rows[0]);
}

export async function getLatestProcesses(limit = 10) {
  const snapshot = await getLatestSnapshot();

  if (!snapshot) {
    return [];
  }

  const [rows] = await pool.query(
    `
      SELECT
        pid,
        \`user\` AS user_name,
        cpuPercent AS cpu_percent,
        memPercent AS memory_percent,
        \`command\` AS command_name,
        \`command\` AS command_line
      FROM process_info
      WHERE \`dateTime\` = ?
      ORDER BY memPercent DESC, cpuPercent DESC
      LIMIT ?
    `,
    [snapshot.sampled_at, limit],
  );

  return rows;
}

export async function getHistory(range) {
  const options = typeof range === "string" ? { range } : range ?? {};
  const window = createHistoryWindow(options);
  const bucket = resolveBucket(window, options.bucket);
  const params = [formatDateBoundary(window.startDate), formatDateBoundary(window.endDate)];

  const [rows] = await pool.query(buildHistoryPointQuery(bucket), params);
  const [summaryRows] = await pool.query(
    `
      SELECT
        ROUND(AVG((cpu.\`cpuMHz\` / NULLIF(cpu.\`cpuMHzMax\`, 0)) * 100), 2) AS cpu_average_percent,
        ROUND(MIN((cpu.\`cpuMHz\` / NULLIF(cpu.\`cpuMHzMax\`, 0)) * 100), 2) AS cpu_min_percent,
        ROUND(MAX((cpu.\`cpuMHz\` / NULLIF(cpu.\`cpuMHzMax\`, 0)) * 100), 2) AS cpu_max_percent,
        ROUND(AVG(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100), 2) AS memory_average_percent,
        ROUND(MIN(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100), 2) AS memory_min_percent,
        ROUND(MAX(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100), 2) AS memory_max_percent,
        ROUND(AVG(disk_info.\`usePercent\`), 2) AS disk_average_percent,
        ROUND(MIN(disk_info.\`usePercent\`), 2) AS disk_min_percent,
        ROUND(MAX(disk_info.\`usePercent\`), 2) AS disk_max_percent
      FROM cpu
      INNER JOIN memory_info ON memory_info.\`dateTime\` = cpu.\`dateTime\`
      INNER JOIN disk_info ON disk_info.\`dateTime\` = cpu.\`dateTime\`
      WHERE cpu.\`dateTime\` BETWEEN ? AND ?
    `,
    params,
  );

  return {
    bucket,
    points: rows.map((row) => ({
      sampled_at: row.sampled_at,
      cpu_percent: Number(row.cpu_percent ?? 0),
      memory_used_percent: Number(row.memory_used_percent ?? 0),
      disk_used_percent: Number(row.disk_used_percent ?? 0),
    })),
    range: window.mode === "absolute"
      ? {
          mode: "absolute",
          start: window.start,
          end: window.end,
        }
      : {
          mode: "relative",
          value: window.range,
        },
    summary: buildSummaryPayload(summaryRows[0]),
  };
}

export async function getLatestPayload() {
  const snapshot = await getLatestSnapshot();

  if (!snapshot) {
    return null;
  }

  const processes = await getLatestProcesses(10);

  return {
    snapshot,
    processes,
  };
}
