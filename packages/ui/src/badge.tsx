import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "brand" | "accent";
}

const TONE_CLASSES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-card text-ink-dim border border-border",
  brand: "bg-brand text-brand-ink",
  accent: "bg-accent text-accent-ink",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1 rounded-pill px-3 font-body text-[13px] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
