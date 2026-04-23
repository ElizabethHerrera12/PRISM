from __future__ import annotations

from dataclasses import dataclass
import os
import socket


@dataclass(slots=True)
class AppConfig:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    sample_interval: int
    top_process_limit: int
    log_level: str
    host_name: str

    @classmethod
    def from_env(cls) -> "AppConfig":
        return cls(
            db_host=os.getenv("PRISM_DB_HOST", "127.0.0.1"),
            db_port=int(os.getenv("PRISM_DB_PORT", "3306")),
            db_name=os.getenv("PRISM_DB_NAME", "prism_document"),
            db_user=os.getenv("PRISM_DB_USER", "prism"),
            db_password=os.getenv("PRISM_DB_PASSWORD", "change_me"),
            sample_interval=int(os.getenv("PRISM_SAMPLE_INTERVAL", "5")),
            top_process_limit=int(os.getenv("PRISM_TOP_PROCESS_LIMIT", "20")),
            log_level=os.getenv("PRISM_LOG_LEVEL", "INFO").upper(),
            host_name=os.getenv("PRISM_HOST_NAME", socket.gethostname()),
        )
