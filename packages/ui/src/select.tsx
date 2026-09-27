import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Same visual family as Input (rounded-xl/focus ring) instead of the
// `rounded-lg`/no-focus-style selects scattered across admin forms.
export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`h-12 w-full appearance-none rounded-xl border border-border bg-card px-4 pr-9 font-body text-ink outline-none focus:border-brand disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </select>
      <span className="material-symbols-rounded pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted">
        expand_more
      </span>
    </div>
  );
}
