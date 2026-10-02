import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// `uiSize`, not `size` — `<input>`/`<textarea>` already have a native
// `size`/`cols`-adjacent meaning in HTML, so reusing that name here would
// either collide with or confusingly shadow it.
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** "md" (default): today's proportions, used everywhere unchanged
   *  (including every admin usage). "sm": every dimension scaled down by
   *  roughly the same ratio — for a screen that wants a visibly lighter,
   *  more compact form without individual inputs, selects and buttons
   *  drifting out of proportion with each other (see Select/Button). */
  uiSize?: "md" | "sm";
}

// The single input style for the whole site (web + admin) — a darker field
// with a visible border against the app's panel/card surfaces reads as an
// actual fillable box without the jarring bright-cream-on-dark-page look
// the previous light-field version had. h-12/text-[15.5px] matches
// Button's h-13/rounded-2xl proportions closely enough that inputs don't
// look visually shorter/thinner than the buttons sitting next to them in
// the same form row.
const SIZE_CLASSES = {
  md: "h-11 md:h-12 px-3.5 md:px-4 text-[14.5px] md:text-[15.5px]",
  sm: "h-10 md:h-11 px-3 md:px-3.5 text-[13px] md:text-[13.5px]",
};

export function Input({ className = "", uiSize = "md", ...props }: InputProps) {
  return (
    <input
      className={`rounded-2xl border border-border bg-ground font-body text-ink outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-brand disabled:opacity-50 ${SIZE_CLASSES[uiSize]} ${className}`}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  uiSize?: "md" | "sm";
}

// No height in this map (unlike Input/Select above) — a textarea's height
// comes from `min-h-24` + content, not a fixed row height, so "sm" here
// only trims padding/font-size to match, not a forced height.
const TEXTAREA_SIZE_CLASSES = {
  md: "px-3.5 md:px-4 text-[14.5px] md:text-[15.5px]",
  sm: "px-3 md:px-3.5 text-[13px] md:text-[13.5px]",
};

export function Textarea({ className = "", uiSize = "md", ...props }: TextareaProps) {
  return (
    <textarea
      className={`min-h-24 rounded-2xl border border-border bg-ground py-2.5 md:py-3 font-body text-ink outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-brand disabled:opacity-50 ${TEXTAREA_SIZE_CLASSES[uiSize]} ${className}`}
      {...props}
    />
  );
}
