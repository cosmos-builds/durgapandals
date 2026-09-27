"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button, Input, Select, Table, TableHeadRow, Th, Tr, Td } from "@durgapandals/ui";

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
}

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS = ["", "DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"];

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
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Pandal> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  useEffect(() => setPage(1), [cityId, status, debouncedSearch]);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (cityId) params.set("cityId", cityId);
    if (status) params.set("status", status);
    if (debouncedSearch) params.set("search", debouncedSearch);

    adminFetch(`/admin/pandals?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setResult);
    setSelected(new Set());
  }, [ready, cityId, status, debouncedSearch, page]);

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
    try {
      await adminFetch("/admin/pandals/bulk-status", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selected), publicationStatus }),
      });
      setResult((prev) =>
        prev
          ? { ...prev, items: prev.items.map((p) => (selected.has(p._id) ? { ...p, publicationStatus } : p)) }
          : prev
      );
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  if (!ready) return null;

  const pandals = result?.items ?? [];

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Pandals</h1>
        <Link href="/pandals/new" className="rounded-xl bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink">
          + Add Pandal
        </Link>
      </div>

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
      </div>

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
          <TableHeadRow>
            <Th className="w-10" />
            <Th>Name</Th>
            <Th>City</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
          </TableHeadRow>
        </thead>
        <tbody>
          {pandals.map((pandal) => (
            <Tr key={pandal._id}>
              <Td>
                <input
                  type="checkbox"
                  checked={selected.has(pandal._id)}
                  onChange={() => toggleSelected(pandal._id)}
                  className="h-4 w-4 accent-brand"
                />
              </Td>
              <Td>
                <Link href={`/pandals/${pandal._id}`} className="font-semibold text-ink hover:text-brand">
                  {pandal.canonicalName}
                </Link>
                <div className="font-body text-xs text-ink-muted">{pandal.locality}</div>
              </Td>
              <Td className="text-ink-muted">{cityNameById.get(pandal.cityId) ?? "—"}</Td>
              <Td>
                <span className={`rounded-pill px-2.5 py-1 font-body text-xs font-bold ${STATUS_TONE[pandal.publicationStatus] ?? "bg-chip text-ink-muted"}`}>
                  {pandal.publicationStatus}
                </span>
              </Td>
              <Td className="text-ink-muted">{timeAgo(pandal.updatedAt)}</Td>
            </Tr>
          ))}
          {pandals.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                No pandals match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {result && result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="font-body text-sm text-ink-muted">
            Page {result.page} of {result.totalPages} · {result.total} total
          </span>
          <Button variant="secondary" disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </AdminShell>
  );
}
