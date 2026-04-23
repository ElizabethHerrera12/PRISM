# PRISM Technical Approach Document

## 1. Introduction

PRISM is a system monitoring tool designed to collect system performance data
from an Ubuntu machine and present that data in a web dashboard that is easier
to understand than raw terminal output.

The system is divided into two main functional areas:

- a background metric collector written in Python
- a web application built with Node.js and React

The data is stored in a MySQL database structure that separates CPU, memory,
disk, and process information into dedicated tables.

## 2. Project Goals

The main goals of PRISM are:

- monitor important machine health information in near real time
- store collected metrics in a structured database
- provide a clean dashboard for users to read current and historical values
- make deployment manageable on Ubuntu using services and package-ready files

## 3. High-Level Architecture

PRISM contains four main parts:

1. Python collector
2. MySQL database
3. Node.js API
4. React dashboard

The complete flow is:

1. The Python collector runs on Ubuntu.
2. It reads CPU, memory, disk, and process information from the operating system.
3. It writes that information into MySQL.
4. The Node.js API reads the latest and historical records from MySQL.
5. The React dashboard calls the API every few seconds and displays the results.

## 4. Main Components

### 4.1 Python Collector

The collector is the background agent of the system.

Its responsibilities are:

- collect system metrics at a fixed interval
- gather top processes by memory usage
- store each sample in the database
- continue running as a daemon through `systemd`

The collector is implemented in Python because it is well suited for system
scripting and has access to libraries such as `psutil`, which simplifies metric
collection.

Important files:

- `agent/prism_agent/main.py`
- `agent/prism_agent/collector.py`
- `agent/prism_agent/metrics.py`
- `agent/prism_agent/database.py`
- `agent/prism_agent/config.py`

### 4.2 MySQL Database

The database stores the collected metrics.

The main tables are:

- `cpu`
- `memory_info`
- `disk_info`
- `process_info`
- `users`

One practical adjustment was required:

- `process_info` uses a composite primary key of `dateTime + pid`

That change is necessary because many process rows can exist at the same exact
timestamp.

Important file:

- `sql/schema.sql`

### 4.3 Node.js API

The API sits between the database and the frontend.

Its responsibilities are:

- expose dashboard-friendly endpoints
- read raw data from the document-style tables
- combine data from multiple tables into one response
- compute values needed by the dashboard, such as memory percent and CPU percent

Important endpoints:

- `GET /api/health`
- `GET /api/metrics/latest`
- `GET /api/metrics/history?range=1h`
- `GET /api/processes/top?limit=10`

Important files:

- `server/src/app.js`
- `server/src/services/metricsService.js`
- `server/src/db.js`
- `server/src/config.js`

### 4.4 React Dashboard

The dashboard is the user-facing part of the project.

Its responsibilities are:

- show current CPU, RAM, disk, and CPU clock metrics
- display historical charts
- display the top processes table
- refresh the display automatically every few seconds

Important files:

- `dashboard/src/App.jsx`
- `dashboard/src/components/MetricCard.jsx`
- `dashboard/src/components/HistoryChart.jsx`
- `dashboard/src/components/ProcessTable.jsx`
- `dashboard/src/styles.css`

## 5. How the System Works in Detail

### 5.1 Metric Collection

The collector uses `psutil` to gather:

- CPU percent
- CPU current/min/max MHz
- memory totals and available memory
- disk total, used, free, and percent used
- process PID, user, CPU percent, memory percent, and command

The collector runs on a schedule controlled by:

- `PRISM_SAMPLE_INTERVAL`

For the deployed version, the interval has been configured to run every
5 seconds.

### 5.2 Memory Handling

The `memory_info` table contains a `MemFree` column. In Linux, raw free memory is
not always a good indicator of usable memory because cache and buffers are also
available to the system when needed.

To make PRISM match tools like `htop` and `free -m` more closely, this project
stores Linux available memory in the schema's `MemFree` field.

This keeps the document structure while producing more realistic dashboard RAM
values.

### 5.3 Database Writes

Each collection cycle writes:

- one row into `cpu`
- one row into `memory_info`
- one row into `disk_info`
- multiple rows into `process_info`

Rows are linked by the same timestamp.

### 5.4 API Processing

Because the database splits CPU, memory, and disk across separate tables,
the API performs joins and calculations before returning data to the frontend.

Examples:

- CPU usage percent is derived from `cpuMHz / cpuMHzMax`
- memory used is derived from `MemTotal - MemFree`
- memory percent is derived from used divided by total
- disk percent is read from `usePercent`

This means the dashboard receives one unified payload even though the database
stores data in separate tables.

### 5.5 Frontend Refresh

The React dashboard refreshes automatically every 5 seconds.

That means:

- the collector creates a fresh database sample every 5 seconds
- the webpage requests the newest data every 5 seconds

The collector and the webpage use the same interval, but for different jobs:

- collector: create new samples
- dashboard: fetch and display the latest samples

## 6. Deployment Approach

The system is intended to run on Ubuntu.

The deployed environment uses:

- `systemd` for service management
- MySQL for data storage
- Node.js for the API and dashboard hosting
- Python virtual environment for collector dependencies

Example runtime services:

- `prism-document-agent`
- `prism-document-web`

This approach allows the system to:

- start automatically on boot
- be restarted independently by component
- be monitored using standard Linux service commands

## 7. Why This Technical Approach Was Chosen

This approach was chosen because it is practical for a class project and still
close to a real deployment design.

### Advantages

- Python is efficient for system metric collection
- MySQL gives persistent structured storage
- Node.js provides a simple API layer
- React creates a clean user dashboard
- `systemd` makes the services manageable on Ubuntu

### Tradeoffs

- the multi-table schema requires more joins than a single-table design
- some percentages must be computed in the API instead of stored directly
- process data needs a composite key because timestamp alone is not enough

## 8. Testing Approach

Testing is important because PRISM is made of several connected parts.

The best approach is to test it at multiple levels:

- unit testing
- integration testing
- system testing
- UI testing
- deployment testing
- negative and failure testing

## 9. Recommended Tests

### 9.1 Unit Tests

Unit tests validate small pieces of logic in isolation.

Examples:

- collector config parsing
- metric formatting logic
- memory usage calculations
- history range parsing such as `1h`, `24h`, and `7d`
- process sorting and pagination logic in the frontend

Why they matter:

- they detect logic bugs early
- they are easy to repeat
- they reduce regressions after small code changes

### 9.2 Integration Tests

Integration tests validate how two or more components work together.

Examples:

- collector writes rows into MySQL successfully
- API reads from the document-style schema correctly
- API joins `cpu`, `memory_info`, and `disk_info` correctly
- top process API returns rows from `process_info`
- frontend renders data returned by the API

Why they matter:

- this project depends heavily on handoff between components
- many failures happen at boundaries rather than inside one file

### 9.3 System Tests

System tests validate the behavior of the full deployed application.

Examples:

- collector service starts correctly with `systemctl`
- web service starts correctly with `systemctl`
- the dashboard loads in a browser
- metrics update after a new collector cycle
- stopping and restarting services works as expected

Why they matter:

- the project is deployed as a real running system on Ubuntu
- passing unit tests alone does not prove the full workflow works

### 9.4 Functional Tests

Functional tests confirm that expected features behave correctly.

Examples:

- CPU card displays current CPU percentage
- RAM card displays percent plus used and total memory
- disk card displays the correct percentage
- charts display historical values
- the top processes table sorts correctly
- the top processes table paginates correctly

Why they matter:

- these tests directly reflect user-visible requirements

### 9.5 UI Tests

UI tests validate presentation and interaction.

Examples:

- dashboard loads on desktop and mobile layouts
- charts render with axes and ticks
- table headers sort when clicked
- pagination buttons change the process page
- cards display the correct values and formatting

Why they matter:

- the dashboard is a major part of the deliverable
- even correct backend data can be misrepresented visually

### 9.6 Deployment and Packaging Tests

These tests validate install and runtime setup.

Examples:

- `.deb` package builds successfully
- config files are installed in the correct locations
- systemd service files are valid
- services start correctly after installation
- the packaged application can connect to MySQL

Why they matter:

- packaging and deployment are part of the project scope

### 9.7 Negative Tests

Negative tests verify that the system behaves safely when something goes wrong.

Examples:

- wrong MySQL password
- database unavailable
- API called when no rows exist yet
- malformed history range in the API request
- process table request with very large limit

Why they matter:

- robust systems must fail clearly, not silently

### 9.8 Performance and Reliability Tests

These tests check whether the tool remains usable over time.

Examples:

- collector running continuously for hours
- dashboard staying responsive with many history points
- CPU and memory overhead of the collector itself
- repeated API polling every 5 seconds

Why they matter:

- a monitor should not become a major source of system load

## 10. Suggested Test Cases

Below is a practical set of tests for the project.

| Test ID | Test Name | Type | Expected Result |
| --- | --- | --- | --- |
| T1 | Collector starts | System | Collector service is active |
| T2 | Web service starts | System | Web service is active |
| T3 | Insert CPU row | Integration | New row appears in `cpu` |
| T4 | Insert memory row | Integration | New row appears in `memory_info` |
| T5 | Insert disk row | Integration | New row appears in `disk_info` |
| T6 | Insert process rows | Integration | Process rows appear in `process_info` |
| T7 | Latest API returns snapshot | Functional | `/api/metrics/latest` returns JSON with current values |
| T8 | History API returns range | Functional | `/api/metrics/history` returns ordered history rows |
| T9 | Top processes API returns list | Functional | `/api/processes/top` returns sorted processes |
| T10 | Dashboard refreshes automatically | UI/System | New values appear without manual refresh |
| T11 | RAM card values are correct | Functional | Displayed RAM values match `free -m` closely |
| T12 | Process sorting works | UI | Table order changes after clicking sort header |
| T13 | Process pagination works | UI | Table switches between pages correctly |
| T14 | Wrong DB password | Negative | Collector/API fail visibly with useful error |
| T15 | Build full package | Deployment | `.deb` file is generated successfully |

## 11. Manual Testing Procedure

A simple manual testing method for the project is:

1. Start the collector service.
2. Start the web service.
3. Open the dashboard in a browser.
4. Compare displayed values with Ubuntu tools such as `htop`, `free -m`, `uptime`, and `ps`.
5. Verify that values refresh every 5 seconds.
6. Check that the top process list matches the current machine state.
7. Stop and restart both services to confirm recovery.

Useful Linux commands for validation:

```bash
free -m
htop
uptime
ps -eo pid,user,%cpu,%mem,comm --sort=-%mem | head
sudo systemctl status prism-document-agent
sudo systemctl status prism-document-web
```

## 12. Automated Testing Opportunities

The following areas are strong candidates for automated tests:

- Python helper logic
- API response structure
- SQL join correctness
- React component rendering
- process table sorting and pagination

Possible tools:

- Python: `pytest`
- Node API: `vitest`, `jest`, or `supertest`
- React UI: `vitest` with React Testing Library
- end-to-end browser tests: `Playwright`

## 13. Risks and Validation Concerns

The main technical risks in this project are:

- mismatch between Linux raw metrics and dashboard interpretation
- differences between the design document schema and real runtime needs
- service configuration problems on Ubuntu
- database permission issues during deployment
- frontend displaying correct data incorrectly

These risks are reduced through:

- direct comparison against `htop`, `free -m`, and `ps`
- integration tests across collector, database, and API
- system tests using the real Ubuntu server

## 14. Conclusion

PRISM uses a practical layered architecture:

- Python for data collection
- MySQL for persistence
- Node.js for API access
- React for visualization

PRISM keeps the database organized by metric type while adapting a few details,
such as process keys and memory interpretation, where needed for correctness.

A good technical validation strategy for PRISM includes:

- unit tests for logic
- integration tests for data flow
- system tests on Ubuntu
- UI tests for dashboard behavior
- negative tests for failures
- deployment and packaging tests

This combination provides strong evidence that the tool works correctly,
matches the project requirements, and can be deployed reliably.
