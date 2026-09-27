import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

// Generalizes the one existing raw <table> in admin (the Pandals list) —
// thin wrappers over the native elements so callers keep full control of
// <thead>/<tbody> structure and colSpan empty-states.
export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-panel">
      <table className={`w-full font-body text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHeadRow({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-border text-left text-ink-muted ${className}`} {...props} />;
}

export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 font-semibold ${className}`} {...props} />;
}

export function Tr({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-border last:border-0 hover:bg-card ${className}`} {...props} />;
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 ${className}`} {...props} />;
}
