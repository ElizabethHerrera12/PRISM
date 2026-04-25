import { useEffect, useState } from "react";

const PAGE_SIZE = 10;
const DEFAULT_SORT = {
  field: "memory_percent",
  direction: "desc",
};

function getSortValue(process, field) {
  if (field === "pid") {
    return Number(process.pid ?? 0);
  }

  if (field === "cpu_percent" || field === "memory_percent") {
    return Number(process[field] ?? 0);
  }

  return String(process[field] ?? "").toLowerCase();
}

function filterProcesses(processes, searchTerm) {
  if (!searchTerm) return processes;

  const term = searchTerm.toLowerCase();

  return processes.filter((process) => {
    return (
      String(process.pid ?? "").includes(term) ||
      String(process.command_name ?? "").toLowerCase().includes(term) ||
      String(process.user_name ?? "").toLowerCase().includes(term)
    );
  });
}

function sortProcesses(processes, field, direction) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...processes].sort((left, right) => {
    const leftValue = getSortValue(left, field);
    const rightValue = getSortValue(right, field);

    if (leftValue < rightValue) {
      return -1 * multiplier;
    }

    if (leftValue > rightValue) {
      return 1 * multiplier;
    }

    return 0;
  });
}

function SortHeader({ label, field, sortField, sortDirection, onSort }) {
  const isActive = sortField === field;
  const indicator = !isActive ? "" : sortDirection === "asc" ? "↑" : "↓";

  return (
    <th scope="col">
      <button className="table-sort" type="button" onClick={() => onSort(field)}>
        <span>{label}</span>
        <span>{indicator}</span>
      </button>
    </th>
  );
}

export default function ProcessTable({ compact = false, processes }) {
  const [sortField, setSortField] = useState(DEFAULT_SORT.field);
  const [sortDirection, setSortDirection] = useState(DEFAULT_SORT.direction);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProcesses = filterProcesses(processes, searchTerm);
  const sortedProcesses = sortProcesses(filteredProcesses, sortField, sortDirection);
  const totalPages = Math.max(1, Math.ceil(sortedProcesses.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedProcesses = sortedProcesses.slice(pageStart, pageStart + PAGE_SIZE);
  const compactProcesses = sortProcesses(processes, "memory_percent", "desc").slice(0, 8);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  function handleSort(field) {
    setPage(1);

    if (field === sortField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "pid" || field === "user_name" || field === "command_name" ? "asc" : "desc");
  }

  if (compact) {
    return (
      <section className="data-panel data-panel--top-processes">
        <div className="data-panel__header data-panel__header--stacked">
          <h2>Top Processes</h2>
        </div>

        <div className="top-processes-list">
          <div className="top-processes-list__head">
            <span>PID</span>
            <span>Name</span>
          </div>
          {compactProcesses.length === 0 ? (
            <p className="top-processes-list__empty">No process data available yet.</p>
          ) : (
            compactProcesses.map((process) => (
              <div className="top-processes-row" key={`${process.pid}-${process.command_name}-${process.user_name ?? "na"}`}>
                <span>{process.pid}</span>
                <strong>{process.command_name}</strong>
              </div>
            ))
          )}
        </div>

        <a href="#processes" className="top-processes__button">
          View All Processes
        </a>
      </section>
    );
  }

  return (
    <div className="process-table-wrap">
      <div className="process-table__toolbar">
        <div className="process-table__search">
          <input
            type="text"
            placeholder="Search by PID, name, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <p>
          Showing {pagedProcesses.length === 0 ? 0 : pageStart + 1}-{pageStart + pagedProcesses.length} of {sortedProcesses.length}
        </p>
        <div className="process-table__pagination">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>

      <div className="process-table__scroll">
        <table className="process-table">
          <thead>
            <tr>
              <SortHeader label="PID" field="pid" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="Name" field="command_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="User" field="user_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="CPU %" field="cpu_percent" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortHeader label="RAM %" field="memory_percent" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {pagedProcesses.length === 0 ? (
              <tr>
                <td colSpan="5" className="process-table__empty">
                  No process data available yet.
                </td>
              </tr>
            ) : (
              pagedProcesses.map((process) => (
                <tr key={`${process.pid}-${process.command_name}-${process.user_name ?? "na"}`}>
                  <td className="process-table__mono">{process.pid}</td>
                  <td className="process-table__name">{process.command_name}</td>
                  <td>{process.user_name ?? "n/a"}</td>
                  <td>{Number(process.cpu_percent ?? 0).toFixed(2)}</td>
                  <td>{Number(process.memory_percent ?? 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
