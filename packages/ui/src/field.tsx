import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

// A labeled form field wrapper — an Input/Select/Textarea plus a visible
// label above it (and an optional hint below), instead of relying on a
// placeholder alone (which disappears the moment someone starts typing,
// and gives screen readers nothing to announce). Wraps the control rather
// than building labels into Input/Select themselves, so grid placement
// classes like `col-span-2` go on this wrapper without fighting the
// control's own className.
export function Field({ label, hint, className = "", children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-body text-xs font-semibold text-ink-muted">{label}</label>
      {children}
      {hint && <span className="font-body text-[11px] text-ink-muted/70">{hint}</span>}
    </div>
  );
}
