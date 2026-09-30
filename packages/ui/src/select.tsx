import type { SelectHTMLAttributes } from "react";

// `uiSize`, not `size` — `<select>` already has a native `size` attribute
// (visible row count) with an unrelated meaning.
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** See Input's `uiSize` — kept in step with it so a Select never looks
   *  shorter/thinner than the Input/Button next to it in the same row. */
  uiSize?: "md" | "sm";
}

const SIZE_CLASSES = {
  md: "h-11 md:h-12 px-3.5 md:px-4 text-[14.5px] md:text-[15.5px]",
  sm: "h-10 md:h-11 px-3 md:px-3.5 text-[13px] md:text-[13.5px]",
};

// Same visual family as Input — a light field, not a dark-on-dark box —
// and the same h-12/rounded-2xl proportions so a Select never looks
// shorter/thinner than the Input or Button next to it in the same row.
export function Select({ className = "", uiSize = "md", children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`w-full appearance-none rounded-2xl bg-ink pr-9 font-body text-ground outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 ${SIZE_CLASSES[uiSize]} ${className}`}
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
