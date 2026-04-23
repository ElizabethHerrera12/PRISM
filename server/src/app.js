import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { getHistory, getLatestPayload, getLatestProcesses } from "./services/metricsService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dashboardDist = path.resolve(__dirname, "../../dashboard/dist");

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "prism-server",
    checkedAt: new Date().toISOString(),
  });
});

app.get("/api/metrics/latest", async (_request, response) => {
  try {
    const payload = await getLatestPayload();

    if (!payload) {
      return response.status(404).json({ message: "No metrics found yet." });
    }

    return response.json(payload);
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
});

app.get("/api/metrics/history", async (request, response) => {
  try {
    const range = request.query.range?.toString() ?? "1h";
    const rows = await getHistory(range);
    return response.json({ range, points: rows });
  } catch (error) {
    return response.status(400).json({ message: error.message });
  }
});

app.get("/api/processes/top", async (request, response) => {
  try {
    const limit = Number.parseInt(request.query.limit?.toString() ?? "10", 10);
    const rows = await getLatestProcesses(limit);
    return response.json({ processes: rows });
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
});

if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(dashboardDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`PRISM server listening on http://localhost:${config.port}`);
});

