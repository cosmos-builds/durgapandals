"use client";

import { useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Danger-styled confirm button for destructive actions (delete). Defaults to true. */
  danger?: boolean;
}

// Every destructive action in admin (delete pandal, delete year, delete
// photo, bulk archive) used to fire immediately on click with no "are you
// sure?" step at all. This is the one place that step now lives, so it's
// consistent everywhere instead of each call site inventing its own.
//
// Stays open on failure and shows the error inline — closing it
// unconditionally would make a failed delete indistinguishable from one the
// admin just decided to cancel (same reasoning as the existing merge dialog
// in apps/admin/app/pandals/[id]/page.tsx).
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  danger = true,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  function handleClose() {
    if (busy) return;
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} title={title}>
      <p className="font-body text-sm text-ink-muted">{description}</p>
      {error && <p className="font-body text-sm text-brand">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={busy} variant={danger ? "primary" : "secondary"}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
