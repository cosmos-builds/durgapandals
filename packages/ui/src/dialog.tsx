"use client";

import { useEffect, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "center": a fixed dialog centered at any viewport width (admin's default).
   *  "sheet": bottom sheet on mobile, centered dialog on desktop (the pattern
   *  apps/web's CitySelectorSheet already hand-rolls) — available for web to
   *  adopt later without admin needing it. */
  variant?: "center" | "sheet";
}

// packages/ui had no Dialog/Modal at all before this — apps/web's two
// hand-rolled sheets (CitySelectorSheet, PandalPreviewSheet) disagree on
// z-index/backdrop opacity/desktop behavior, so this picks one canonical
// shell rather than extracting either of them, and adds the a11y basics
// (Escape to close, role="dialog") neither of those had.
export function Dialog({ open, onClose, title, children, variant = "center" }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const sheetClasses =
    variant === "sheet"
      ? "fixed inset-x-0 bottom-0 flex max-h-[80dvh] flex-col gap-4 rounded-t-sheet bg-panel p-5 pb-8 shadow-2xl md:inset-0 md:m-auto md:h-fit md:max-h-[600px] md:w-[420px] md:rounded-3xl"
      : "fixed inset-0 m-auto flex h-fit max-h-[85dvh] w-[min(480px,calc(100vw-32px))] flex-col gap-4 overflow-y-auto rounded-card bg-panel p-6 shadow-2xl";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className={`z-50 ${sheetClasses}`}>
        {title && (
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
