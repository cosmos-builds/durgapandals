"use client";

import { useEffect, useState } from "react";
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
  canonicalName: string;
  locality: string;
  publicationStatus: string;
  verificationStatus: string;
}

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS = ["", "DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"];

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
          className="h-11 md:flex-1"
        />
        <Select value={cityId} onChange={(e) => setCityId(e.target.value)} className="h-11 md:w-56">
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city._id} value={city._id}>
              {city.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 md:w-48">
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
            <Th>Locality</Th>
            <Th>Status</Th>
            <Th>Verification</Th>
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
              </Td>
              <Td className="text-ink-muted">{pandal.locality}</Td>
              <Td className="text-ink-muted">{pandal.publicationStatus}</Td>
              <Td className="text-ink-muted">{pandal.verificationStatus}</Td>
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
