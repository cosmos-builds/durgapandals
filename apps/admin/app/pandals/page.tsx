"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  type ColumnDef,
  type ExpandedState,
  type GroupingState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch, adminMutate, deletePandal } from "@/lib/admin-api";
import { Button, ConfirmDialog, Input, Select, Table, TableHeadRow, Th, Tr, Td, useToast } from "@durgapandals/ui";

const MotionTr = motion.create(Tr);
import { PandalsClusterMap, type DashboardPandal } from "@/components/pandals-cluster-map";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";
const INDIA_CENTER = { latitude: 22.9734, longitude: 78.6569 };

interface City {
  _id: string;
  name: string;
}

interface Pandal {
  _id: string;
  cityId: string;
  canonicalName: string;
  locality: string;
  publicationStatus: string;
  verificationStatus: string;
  updatedAt: string;
  yearCount: number;
  hasCurrentYearEntry: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS = ["", "DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"];
const YEAR_OPTIONS = ["", String(CURRENT_YEAR + 1), String(CURRENT_YEAR), String(CURRENT_YEAR - 1), "none"];

// Column ids double as the server's sortBy values — "name"/"locality"/
// "status"/"updated" match SORT_FIELD in the admin pandals API route
// exactly, so a TanStack sort click maps straight onto a server param with
// no translation table needed.
const GROUP_OPTIONS = [
  { value: "", label: "No grouping" },
  { value: "status", label: "Group by status" },
  { value: "cityName", label: "Group by city" },
];

// Sorting is server-side (SORT_FIELD in the API route) since the table is
// paginated — grouping isn't, since a group needs every matching row in
// view at once, not just the current page. When grouping is on, this fetch
// switches to one large unpaginated page instead.
const GROUPED_PAGE_SIZE = 500;

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "bg-[rgba(127,217,154,.18)] text-[#7FD99A]",
  PENDING: "bg-[rgba(255,181,71,.18)] text-accent",
  DRAFT: "bg-chip text-ink-muted",
  ARCHIVED: "bg-chip text-ink-muted",
  REJECTED: "bg-[rgba(255,68,51,.18)] text-brand",
};

// "2h ago" / "3d ago" — matches the mockup's UPDATED column, computed from
// the real updatedAt timestamp Mongoose already tracks (no new field).
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PandalsListPage() {
  const ready = useAdminGuard();
  const toast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [view, setView] = useState<"table" | "map">("table");
  const [mapPandals, setMapPandals] = useState<DashboardPandal[]>([]);
  const [selectedMapPandal, setSelectedMapPandal] = useState<DashboardPandal | null>(null);
  const [result, setResult] = useState<Page<Pandal> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pandal | null>(null);

  const isGrouped = grouping.length > 0;

  useEffect(() => {
    if (!ready) return;
    adminFetch("/admin/cities")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCities);
  }, [ready]);

  const cityNameById = useMemo(() => new Map(cities.map((c) => [c._id, c.name])), [cities]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [cityId, status, year, debouncedSearch]);

  // Shared by both fetch effects below, so the map view can never drift out
  // of sync with whatever the table's filters currently say.
  function buildFilterParams() {
    const params = new URLSearchParams();
    if (cityId) params.set("cityId", cityId);
    if (status) params.set("status", status);
    if (year) params.set("year", year);
    if (debouncedSearch) params.set("search", debouncedSearch);
    return params;
  }

  const VALID_SERVER_SORT_KEYS = new Set(["name", "locality", "status", "updated"]);

  useEffect(() => {
    if (!ready || view !== "table") return;
    const params = buildFilterParams();
    // Grouping needs every matching row in view at once, not just one page
    // — the table falls back to one large fetch and hides its own
    // pagination controls while a group-by is active.
    params.set("page", String(isGrouped ? 1 : page));
    params.set("pageSize", String(isGrouped ? GROUPED_PAGE_SIZE : 25));
    const sort = sorting[0];
    if (sort && VALID_SERVER_SORT_KEYS.has(sort.id)) {
      params.set("sortBy", sort.id);
      params.set("sortDir", sort.desc ? "desc" : "asc");
    }

    adminFetch(`/admin/pandals?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setResult);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, cityId, status, year, debouncedSearch, page, sorting, isGrouped]);

  // The map has no pagination — it plots every pandal matching the current
  // filters, not just the table's current page, since "every pandal in the
  // list" is the whole point of the map view.
  useEffect(() => {
    if (!ready || view !== "map") return;
    const params = buildFilterParams();
    adminFetch(`/admin/pandals-map?${params}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setMapPandals);
    setSelectedMapPandal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, cityId, status, year, debouncedSearch]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetStatus(publicationStatus: string) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const result = await adminMutate("/admin/pandals/bulk-status", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selected), publicationStatus }),
      });
      if (!result.ok) {
        // Doesn't touch `result`'s rows (the visible table) on failure —
        // rewriting every selected row's status locally regardless of
        // whether the bulk PATCH succeeded was the actual bug: a failed
        // request looked exactly like a successful one.
        setError(result.error ?? "Couldn't update status.");
        toast.error(result.error ?? "Couldn't update status.");
        return;
      }
      setResult((prev) =>
        prev
          ? { ...prev, items: prev.items.map((p) => (selected.has(p._id) ? { ...p, publicationStatus } : p)) }
          : prev
      );
      setSelected(new Set());
      toast.success(`${publicationStatus === "PUBLISHED" ? "Published" : "Archived"} ${selected.size} pandal(s).`);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deletePandal(deleteTarget._id);
    if (!result.ok) throw new Error(result.error ?? "Couldn't delete pandal.");
    setResult((prev) => (prev ? { ...prev, items: prev.items.filter((p) => p._id !== deleteTarget._id) } : prev));
    setDeleteTarget(null);
    toast.success(`"${deleteTarget.canonicalName}" deleted.`);
  }

  const pandals = result?.items ?? [];

  const columns = useMemo<ColumnDef<Pandal>[]>(
    () => [
      {
        id: "select",
        header: "",
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original._id)}
            onChange={() => toggleSelected(row.original._id)}
            className="h-4 w-4 accent-brand"
          />
        ),
      },
      {
        id: "name",
        accessorKey: "canonicalName",
        header: "Name",
        enableGrouping: false,
        cell: ({ row }) => (
          <Link href={`/pandals/${row.original._id}`} className="font-semibold text-ink hover:text-brand">
            {row.original.canonicalName}
          </Link>
        ),
      },
      {
        id: "cityName",
        header: "City",
        enableSorting: false,
        accessorFn: (row) => cityNameById.get(row.cityId) ?? "—",
      },
      {
        id: "locality",
        accessorKey: "locality",
        header: "Locality",
      },
      {
        id: "status",
        accessorKey: "publicationStatus",
        header: "Status",
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return (
            <span className={`rounded-pill px-2.5 py-1 font-body text-xs font-bold ${STATUS_TONE[value] ?? "bg-chip text-ink-muted"}`}>
              {value}
            </span>
          );
        },
      },
      {
        id: "history",
        header: "History",
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) => {
          const pandal = row.original;
          return (
            <div className="flex flex-col gap-1 font-body text-xs">
              <span className="text-ink-muted">
                {pandal.yearCount === 0 ? "No years added" : `${pandal.yearCount} year${pandal.yearCount === 1 ? "" : "s"} on record`}
              </span>
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-pill px-2 py-0.5 font-bold ${
                  pandal.hasCurrentYearEntry ? "bg-[rgba(127,217,154,.18)] text-[#7FD99A]" : "bg-chip text-ink-muted"
                }`}
              >
                {pandal.hasCurrentYearEntry ? `${CURRENT_YEAR} ✓` : `No ${CURRENT_YEAR} entry`}
              </span>
            </div>
          );
        },
      },
      {
        id: "updated",
        accessorKey: "updatedAt",
        header: "Updated",
        enableGrouping: false,
        cell: ({ getValue }) => timeAgo(getValue<string>()),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableGrouping: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setDeleteTarget(row.original)}
            aria-label={`Delete ${row.original.canonicalName}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-brand/10 hover:text-brand"
          >
            <span className="material-symbols-rounded text-lg">delete</span>
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cityNameById, selected]
  );

  const table = useReactTable({
    data: pandals,
    columns,
    state: { sorting, grouping, expanded },
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    manualSorting: true,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row._id,
  });

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Pandals</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-border p-1">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm font-bold ${
                view === "table" ? "bg-brand text-brand-ink" : "text-ink-muted"
              }`}
            >
              <span className="material-symbols-rounded text-lg">table_rows</span>
              Table
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm font-bold ${
                view === "map" ? "bg-brand text-brand-ink" : "text-ink-muted"
              }`}
            >
              <span className="material-symbols-rounded text-lg">map</span>
              Map
            </button>
          </div>
          <Link href="/pandals/new">
            <Button>+ Add Pandal</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 font-body text-sm text-brand">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input
          placeholder="Search by name or locality…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 md:flex-1"
        />
        <Select value={cityId} onChange={(e) => setCityId(e.target.value)} className="h-12 md:w-56">
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city._id} value={city._id}>
              {city.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-12 md:w-48">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="h-12 md:w-48">
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y === "" ? "All years" : y === "none" ? "No festival year added" : `Has ${y} entry`}
            </option>
          ))}
        </Select>
        {view === "table" && (
          <Select
            value={grouping[0] ?? ""}
            onChange={(e) => {
              setGrouping(e.target.value ? [e.target.value] : []);
              setPage(1);
            }}
            className="h-12 md:w-48"
          >
            {GROUP_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {view === "map" ? (
        <>
          <p className="mb-3 font-body text-sm text-ink-muted">
            {mapPandals.length} pandal{mapPandals.length === 1 ? "" : "s"} plotted, matching the filters above — red
            pins are published, gray pins are everything else. Click a pin for details.
          </p>
          {/* Left/right on desktop, stacked top/bottom on mobile — matches
              how the map's own pin-click detail view should read on either
              layout, rather than navigating away from the map entirely. */}
          <div className="flex flex-col gap-3 md:flex-row">
            <PandalsClusterMap
              mapTilesUrl={MAP_TILES_URL}
              center={
                mapPandals.length > 0
                  ? {
                      latitude: mapPandals.reduce((sum, p) => sum + p.latitude, 0) / mapPandals.length,
                      longitude: mapPandals.reduce((sum, p) => sum + p.longitude, 0) / mapPandals.length,
                    }
                  : INDIA_CENTER
              }
              zoom={mapPandals.length > 0 ? 5 : 4}
              pandals={mapPandals}
              onSelectPandal={setSelectedMapPandal}
              className="h-[420px] w-full md:h-[560px] md:flex-1"
            />
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4 md:h-[560px] md:w-[300px] md:flex-none md:overflow-y-auto">
              {selectedMapPandal ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-lg font-bold">{selectedMapPandal.canonicalName}</div>
                      <div className="font-body text-sm text-ink-muted">
                        {selectedMapPandal.locality ?? "—"} · {cityNameById.get(selectedMapPandal.cityId ?? "") ?? "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMapPandal(null)}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-ink-muted hover:bg-card"
                    >
                      <span className="material-symbols-rounded text-lg">close</span>
                    </button>
                  </div>
                  <span
                    className={`w-fit rounded-pill px-2.5 py-1 font-body text-xs font-bold ${
                      STATUS_TONE[selectedMapPandal.publicationStatus] ?? "bg-chip text-ink-muted"
                    }`}
                  >
                    {selectedMapPandal.publicationStatus}
                  </span>
                  <Link href={`/pandals/${selectedMapPandal.id}`}>
                    <Button className="w-full">Open pandal</Button>
                  </Link>
                </>
              ) : (
                <p className="font-body text-sm text-ink-muted">Click a pin on the map to see its details here.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-body text-sm text-ink-muted">{selected.size} selected</span>
          <Button variant="secondary" disabled={bulkBusy} onClick={() => bulkSetStatus("PUBLISHED")}>
            Publish
          </Button>
          <Button variant="secondary" disabled={bulkBusy} onClick={() => bulkSetStatus("ARCHIVED")}>
            Archive
          </Button>
        </div>
      )}

      <Table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableHeadRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Th key={header.id} className={header.column.id === "select" || header.column.id === "actions" ? "w-10" : undefined}>
                  {header.column.getCanSort() ? (
                    <button type="button" onClick={header.column.getToggleSortingHandler()} className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {/* Always shown, not just once a column becomes the active
                          sort — a dimmed placeholder on every sortable column
                          signals upfront that it's clickable, instead of only
                          the active column ever showing an icon. */}
                      <span
                        className={`material-symbols-rounded text-sm ${
                          header.column.getIsSorted() ? "text-ink" : "text-ink-muted/40"
                        }`}
                      >
                        {header.column.getIsSorted() === "desc"
                          ? "arrow_downward"
                          : header.column.getIsSorted() === "asc"
                            ? "arrow_upward"
                            : "unfold_more"}
                      </span>
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </Th>
              ))}
            </TableHeadRow>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, index) =>
            row.getIsGrouped() ? (
              <tr key={row.id} className="border-t border-border bg-card/60">
                <td colSpan={row.getVisibleCells().length} className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={row.getToggleExpandedHandler()}
                    className="flex items-center gap-1.5 font-body text-sm font-bold"
                  >
                    <span className="material-symbols-rounded text-lg">{row.getIsExpanded() ? "expand_more" : "chevron_right"}</span>
                    {String(row.getValue(row.groupingColumnId as string))}
                    <span className="font-body text-xs font-normal text-ink-muted">({row.subRows.length})</span>
                  </button>
                </td>
              </tr>
            ) : (
              <MotionTr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index, 20) * 0.015 }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                ))}
              </MotionTr>
            )
          )}
          {pandals.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-ink-muted">
                No pandals match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this pandal?"
        description={
          deleteTarget
            ? `"${deleteTarget.canonicalName}" and all of its festival years, photos, and likes will be permanently deleted. This can't be undone.`
            : ""
        }
        confirmLabel="Delete pandal"
      />

      {!isGrouped && result && result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="font-body text-sm text-ink-muted">
            Showing {(result.page - 1) * result.pageSize + 1}–
            {Math.min(result.page * result.pageSize, result.total)} of {result.total} records
          </span>
          <Button variant="secondary" disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
        </>
      )}
    </AdminShell>
  );
}
