import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  /** "md" (default): today's h-13/text-base proportions, unchanged for
   *  every existing usage (including all of admin). "sm": scaled down by
   *  roughly the same ratio as Input/Select's `uiSize="sm"`, for a screen
   *  that wants a visibly lighter, more compact form. */
  uiSize?: "md" | "sm";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover",
  secondary: "bg-card border border-border text-ink",
  ghost: "bg-transparent text-ink",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["uiSize"]>, string> = {
  md: "h-13 px-5 text-base",
  sm: "h-11 px-4 text-sm",
};

export function Button({ variant = "primary", uiSize = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-2xl font-body font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[uiSize]} ${className}`}
      {...props}
    />
  );
}
