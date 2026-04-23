from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import mysql.connector

from prism_agent.config import AppConfig
from prism_agent.types import ProcessMetric, SnapshotMetric


class DatabaseClient:
    def __init__(self, config: AppConfig) -> None:
        self._config = config

    @contextmanager
    def _connection(self) -> Iterator[mysql.connector.MySQLConnection]:
        connection = mysql.connector.connect(
            host=self._config.db_host,
            port=self._config.db_port,
            user=self._config.db_user,
            password=self._config.db_password,
            database=self._config.db_name,
        )
        try:
            yield connection
        finally:
            connection.close()

    def insert_snapshot(self, snapshot: SnapshotMetric) -> str:
        with self._connection() as connection:
            cursor = connection.cursor()
            sampled_at = snapshot.sampled_at

            cursor.execute(
                """
                INSERT INTO cpu (`dateTime`, `cpuMHz`, `cpuMHzMin`, `cpuMHzMax`)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    `cpuMHz` = VALUES(`cpuMHz`),
                    `cpuMHzMin` = VALUES(`cpuMHzMin`),
                    `cpuMHzMax` = VALUES(`cpuMHzMax`)
                """,
                (
                    sampled_at,
                    round(snapshot.cpu_mhz or 0.0, 3),
                    round(snapshot.cpu_mhz_min or 0.0, 3),
                    round(snapshot.cpu_mhz_max or 0.0, 3),
                ),
            )

            cursor.execute(
                """
                INSERT INTO memory_info (`dateTime`, `MemTotal`, `MemFree`)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    `MemTotal` = VALUES(`MemTotal`),
                    `MemFree` = VALUES(`MemFree`)
                """,
                (
                    sampled_at,
                    snapshot.memory_total_mb,
                    snapshot.memory_free_mb,
                ),
            )

            cursor.execute(
                """
                INSERT INTO disk_info (`dateTime`, `size`, `used`, `avail`, `usePercent`)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    `size` = VALUES(`size`),
                    `used` = VALUES(`used`),
                    `avail` = VALUES(`avail`),
                    `usePercent` = VALUES(`usePercent`)
                """,
                (
                    sampled_at,
                    round(snapshot.disk_total_gb, 1),
                    round(snapshot.disk_used_gb, 1),
                    round(snapshot.disk_available_gb, 1),
                    int(round(snapshot.disk_used_percent)),
                ),
            )

            cursor.execute("DELETE FROM process_info WHERE `dateTime` = %s", (sampled_at,))

            process_rows = [
                self._process_row(sampled_at, process)
                for process in snapshot.processes
            ]

            if process_rows:
                cursor.executemany(
                    """
                    INSERT INTO process_info (
                        `dateTime`,
                        `pid`,
                        `user`,
                        `cpuPercent`,
                        `memPercent`,
                        `command`
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    process_rows,
                )

            connection.commit()
            cursor.close()
            return sampled_at.isoformat(sep=" ")

    @staticmethod
    def _process_row(sampled_at, process: ProcessMetric) -> tuple:
        user_name = (process.user_name or "unknown")[:20]
        command_name = (process.command_name or "unknown")[:40]

        return (
            sampled_at,
            process.pid,
            user_name,
            int(round(process.cpu_percent)),
            int(round(process.memory_percent)),
            command_name,
        )
