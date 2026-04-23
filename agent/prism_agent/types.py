from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(slots=True)
class ProcessMetric:
    pid: int
    user_name: str | None
    cpu_percent: float
    memory_percent: float
    command_name: str
    command_line: str | None


@dataclass(slots=True)
class SnapshotMetric:
    host_name: str
    sampled_at: datetime
    cpu_percent: float
    cpu_mhz: float | None
    cpu_mhz_min: float | None
    cpu_mhz_max: float | None
    memory_total_mb: int
    memory_free_mb: int
    memory_available_mb: int
    memory_used_mb: int
    memory_used_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_available_gb: float
    disk_used_percent: float
    network_bytes_sent: int
    network_bytes_recv: int
    processes: list[ProcessMetric]
