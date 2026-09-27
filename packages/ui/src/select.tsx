import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Same visual family as Input — a light field, not a dark-on-dark box —
// and the same h-12/rounded-2xl proportions so a Select never looks
// shorter/thinner than the Input or Button next to it in the same row.
export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`h-12 w-full appearance-none rounded-2xl bg-ink px-4 pr-9 font-body text-[15.5px] text-ground outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
      </select>
      {/* text-ground/50, not text-ink-muted — see input.tsx's comment: this
          icon sits on the same light field, so it needs the dark-muted
          pairing, not the light-on-dark one. */}
      <span className="material-symbols-rounded pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ground/50">
        expand_more
      </span>
    </div>
  );
}
