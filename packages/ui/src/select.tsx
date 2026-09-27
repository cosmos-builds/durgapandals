import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Same visual family as Input — a light field, not a dark-on-dark box.
export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`h-11 w-full appearance-none rounded-xl bg-ink px-4 pr-9 font-body text-[15px] text-ground outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 ${className}`}
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
