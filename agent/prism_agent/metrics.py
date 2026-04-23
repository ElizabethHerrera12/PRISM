from __future__ import annotations

from datetime import datetime, timezone

import psutil

from prism_agent.types import ProcessMetric, SnapshotMetric


BYTES_PER_MB = 1024 * 1024
BYTES_PER_GB = 1024 * 1024 * 1024


class MetricReader:
    def __init__(self, host_name: str, top_process_limit: int) -> None:
        self.host_name = host_name
        self.top_process_limit = top_process_limit
        psutil.cpu_percent(interval=None)

    def collect(self) -> SnapshotMetric:
        cpu_percent = float(psutil.cpu_percent(interval=None))
        cpu_freq = psutil.cpu_freq()
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        network = psutil.net_io_counters()

        processes = self._collect_processes()

        return SnapshotMetric(
            host_name=self.host_name,
            sampled_at=datetime.now(timezone.utc).replace(tzinfo=None),
            cpu_percent=round(cpu_percent, 2),
            cpu_mhz=round(cpu_freq.current, 2) if cpu_freq else None,
            cpu_mhz_min=round(cpu_freq.min, 2) if cpu_freq else None,
            cpu_mhz_max=round(cpu_freq.max, 2) if cpu_freq else None,
            memory_total_mb=int(memory.total / BYTES_PER_MB),
            # The document schema only gives us MemTotal/MemFree. On Linux,
            # "available" memory tracks what tools like htop/free report as
            # usable memory much better than the raw "free" counter.
            memory_free_mb=int(memory.available / BYTES_PER_MB),
            memory_available_mb=int(memory.available / BYTES_PER_MB),
            memory_used_mb=int(memory.used / BYTES_PER_MB),
            memory_used_percent=round(float(memory.percent), 2),
            disk_total_gb=round(disk.total / BYTES_PER_GB, 2),
            disk_used_gb=round(disk.used / BYTES_PER_GB, 2),
            disk_available_gb=round(disk.free / BYTES_PER_GB, 2),
            disk_used_percent=round(float(disk.percent), 2),
            network_bytes_sent=int(network.bytes_sent),
            network_bytes_recv=int(network.bytes_recv),
            processes=processes,
        )

    def _collect_processes(self) -> list[ProcessMetric]:
        processes: list[ProcessMetric] = []

        for process in psutil.process_iter(
            attrs=["pid", "username", "cpu_percent", "memory_percent", "name", "cmdline"]
        ):
            try:
                info = process.info
                command_line = " ".join(info.get("cmdline") or []) or None
                processes.append(
                    ProcessMetric(
                        pid=int(info["pid"]),
                        user_name=info.get("username"),
                        cpu_percent=round(float(info.get("cpu_percent") or 0.0), 2),
                        memory_percent=round(float(info.get("memory_percent") or 0.0), 2),
                        command_name=str(info.get("name") or "unknown"),
                        command_line=command_line,
                    )
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        processes.sort(key=lambda item: (item.memory_percent, item.cpu_percent), reverse=True)
        return processes[: self.top_process_limit]
