import os from "node:os";

import { pool } from "../db.js";

const HOST_NAME = process.env.PRISM_HOST_NAME ?? os.hostname();

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
  const startDate = rangeToStartDate(range);
  const [rows] = await pool.query(
    `
      SELECT
        cpu.\`dateTime\` AS sampled_at,
        ROUND((cpu.\`cpuMHz\` / NULLIF(cpu.\`cpuMHzMax\`, 0)) * 100, 2) AS cpu_percent,
        ROUND(((memory_info.\`MemTotal\` - memory_info.\`MemFree\`) / NULLIF(memory_info.\`MemTotal\`, 0)) * 100, 2) AS memory_used_percent,
        disk_info.\`usePercent\` AS disk_used_percent
      FROM cpu
      INNER JOIN memory_info ON memory_info.\`dateTime\` = cpu.\`dateTime\`
      INNER JOIN disk_info ON disk_info.\`dateTime\` = cpu.\`dateTime\`
      WHERE cpu.\`dateTime\` >= ?
      ORDER BY cpu.\`dateTime\` ASC
    `,
    [startDate],
  );

  return rows.map((row) => ({
    sampled_at: row.sampled_at,
    cpu_percent: Number(row.cpu_percent ?? 0),
    memory_used_percent: Number(row.memory_used_percent ?? 0),
    disk_used_percent: Number(row.disk_used_percent ?? 0),
  }));
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
