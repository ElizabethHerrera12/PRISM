# PRISM

PRISM is a system monitoring platform for Ubuntu that collects system
performance data and displays it in a web dashboard.

The system has three main parts:

- a Python collector that runs in the background
- a MySQL database that stores collected metrics
- a Node.js and React web application that presents the data

## Database schema

Use `sql/schema.sql` to create the database.

It creates these tables:

- `cpu`
- `memory_info`
- `disk_info`
- `process_info`
- `users`

`process_info` uses a composite primary key of `dateTime + pid`. This is needed
because multiple process rows can be collected at the same timestamp.

The `users` table is part of the application design, but it is not populated by
the collector because it represents application accounts rather than machine
telemetry.

For memory, PRISM stores Linux available memory in `memory_info.MemFree`. That
keeps the table structure simple while making the displayed RAM values line up
much better with tools like `htop` and `free`.

## Data collected

Each collection cycle stores:

- CPU clock data: current MHz, min MHz, max MHz
- memory data: total MB and available MB stored in `MemFree`
- disk data: size, used, available, percent used
- process data: pid, user, CPU percent, memory percent, command

## Collector configuration

Example file: `agent/config/prism-agent.env.example`

```bash
PRISM_DB_HOST=127.0.0.1
PRISM_DB_PORT=3306
PRISM_DB_NAME=prism_document
PRISM_DB_USER=prism
PRISM_DB_PASSWORD=change_me
PRISM_SAMPLE_INTERVAL=5
PRISM_TOP_PROCESS_LIMIT=20
PRISM_LOG_LEVEL=INFO
```

## API configuration

Example file: `server/.env.example`

```bash
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=prism_document
DB_USER=prism
DB_PASSWORD=change_me
CORS_ORIGIN=http://localhost:4000
```

## Local setup

1. Create the database with `sql/schema.sql`.
2. Configure the collector environment values.
3. Configure the API environment values.
4. Start the collector.
5. Start the Node.js API.
6. Start or build the React dashboard.

## Packaging

The repository includes two Debian packaging scripts:

- `scripts/build-agent-deb.sh`
- `scripts/build-full-deb.sh`

The full package includes the collector, API, dashboard assets, and schema
files for Ubuntu deployment.
