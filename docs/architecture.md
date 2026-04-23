# Architecture Notes

## Overview

PRISM is a layered monitoring system built for Ubuntu.

Its main flow is:

1. The collector reads live operating system metrics.
2. The collector stores them in MySQL.
3. The API reads and combines those records.
4. The dashboard requests the API and displays the results.

## Components

### Collector

The collector is a Python service intended to run continuously in the
background.

It samples:

- CPU clock data
- memory totals and available memory
- disk usage on `/`
- top processes by memory consumption

Each sample is written into the MySQL schema as:

- one row in `cpu`
- one row in `memory_info`
- one row in `disk_info`
- many rows in `process_info`

### Database

The database stores the system metrics using separate tables for CPU, memory,
disk, and processes.

The main tables are:

- `cpu`
- `memory_info`
- `disk_info`
- `process_info`
- `users`

The collector links related rows by timestamp.

Because many processes can be collected at the same moment, `process_info` uses
a composite key of `dateTime + pid`.

### API

The API is a Node.js service that exposes:

- `GET /api/health`
- `GET /api/metrics/latest`
- `GET /api/metrics/history?range=1h`
- `GET /api/processes/top?limit=10`

Because the database stores CPU, memory, and disk in separate tables, the API
joins them and computes the values needed by the frontend, such as:

- CPU usage percent
- memory used in MB
- memory usage percent
- disk usage percent

### Dashboard

The dashboard is a React SPA that polls the API and displays:

- current CPU, memory, and disk usage
- current CPU clock speed
- recent history trend lines
- the top active processes

The dashboard refreshes automatically every 5 seconds.

## Runtime Design

On Ubuntu, PRISM is designed to run through `systemd`.

Typical runtime services are:

- collector service
- web service

This makes the system easier to:

- start and stop
- restart after changes
- monitor in production
- configure for automatic startup
