import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Same visual family as Input — a light field, not a dark-on-dark box.
export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`h-14 w-full appearance-none rounded-2xl bg-ink px-5 pr-10 font-body text-ground outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </select>
      <span className="material-symbols-rounded pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
        expand_more
      </span>
    </div>
  );
}
