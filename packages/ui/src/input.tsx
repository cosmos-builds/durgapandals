import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

// The single input style for the whole site (web + admin) — a light field
// against the app's dark surfaces reads as an actual fillable box instead
// of blending into the card/panel behind it. h-12/text-[15.5px] matches
// Button's h-13/rounded-2xl proportions closely enough that inputs don't
// look visually shorter/thinner than the buttons sitting next to them in
// the same form row.
//
// Placeholder color is `text-ground/50`, not `text-ink-muted` — `ink-muted`
// is a light cream tone meant for muted text on the app's DARK surfaces
// (panel/card); used as a placeholder inside this light field it was
// rendering as near-invisible light-on-light. `ground` is the same dark
// color already used for the field's real value text, just faded — dark
// muted text on a light field, matching how "muted" is supposed to read
// here.
const BASE_CLASSES =
  "h-12 rounded-2xl bg-ink px-4 font-body text-[15.5px] text-ground outline-none placeholder:text-ground/50 focus:ring-2 focus:ring-brand disabled:opacity-50";

export function Input({ className = "", ...props }: InputProps) {
  return <input className={`${BASE_CLASSES} ${className}`} {...props} />;
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`min-h-24 rounded-2xl bg-ink px-4 py-3 font-body text-[15.5px] text-ground outline-none placeholder:text-ground/50 focus:ring-2 focus:ring-brand disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
