"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";

interface Pandal {
  _id: string;
  canonicalName: string;
  locality: string;
  publicationStatus: string;
  verificationStatus: string;
}

export default function PandalsListPage() {
  const ready = useAdminGuard();
  const [pandals, setPandals] = useState<Pandal[]>([]);

  useEffect(() => {
    if (!ready) return;
    adminFetch("/admin/pandals?pageSize=100")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((page) => setPandals(page.items));
  }, [ready]);

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Pandals</h1>
        <Link href="/pandals/new" className="rounded-xl bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink">
          + Add Pandal
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-panel">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-muted">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Locality</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Verification</th>
            </tr>
          </thead>
          <tbody>
            {pandals.map((pandal) => (
              <tr key={pandal._id} className="border-b border-border last:border-0 hover:bg-card">
                <td className="px-4 py-3">
                  <Link href={`/pandals/${pandal._id}`} className="font-semibold text-ink hover:text-brand">
                    {pandal.canonicalName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted">{pandal.locality}</td>
                <td className="px-4 py-3 text-ink-muted">{pandal.publicationStatus}</td>
                <td className="px-4 py-3 text-ink-muted">{pandal.verificationStatus}</td>
              </tr>
            ))}
            {pandals.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  No pandals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
