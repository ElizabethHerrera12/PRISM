from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict

from prism_agent.config import AppConfig
from prism_agent.database import DatabaseClient
from prism_agent.metrics import MetricReader


LOGGER = logging.getLogger(__name__)


class CollectorService:
    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._reader = MetricReader(config.host_name, config.top_process_limit)
        self._database = DatabaseClient(config)

    def collect_once(self, persist: bool = True) -> dict:
        snapshot = self._reader.collect()
        payload = asdict(snapshot)

        if persist:
            snapshot_key = self._database.insert_snapshot(snapshot)
            LOGGER.info("Stored snapshot %s with %s processes", snapshot_key, len(snapshot.processes))
            payload["snapshot_key"] = snapshot_key

        return payload

    def run_forever(self) -> None:
        LOGGER.info(
            "Starting PRISM collector on host %s with %ss interval",
            self._config.host_name,
            self._config.sample_interval,
        )

        while True:
            started_at = time.monotonic()
            try:
                self.collect_once(persist=True)
            except Exception:
                LOGGER.exception("Collector iteration failed")

            elapsed = time.monotonic() - started_at
            delay = max(1, self._config.sample_interval - int(elapsed))
            time.sleep(delay)

    @staticmethod
    def to_json(payload: dict) -> str:
        return json.dumps(payload, default=str, indent=2)
