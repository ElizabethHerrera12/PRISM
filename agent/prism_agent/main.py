from __future__ import annotations

import argparse

from prism_agent.collector import CollectorService
from prism_agent.config import AppConfig
from prism_agent.logging_config import configure_logging


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PRISM metric collection agent")
    parser.add_argument("--once", action="store_true", help="Collect one sample and exit")
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Print the collected snapshot to stdout",
    )
    parser.add_argument(
        "--no-persist",
        action="store_true",
        help="Do not write metrics to MySQL",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = AppConfig.from_env()
    configure_logging(config.log_level)

    service = CollectorService(config)

    if args.once:
        payload = service.collect_once(persist=not args.no_persist)
        if args.print_json:
            print(service.to_json(payload))
        return 0

    service.run_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

