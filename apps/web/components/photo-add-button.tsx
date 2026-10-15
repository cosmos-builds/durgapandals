"use client";

import { useEffect, useRef, useState } from "react";

export interface PhotoAddButtonProps {
  uploading: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

// One hidden <input type="file"> only ever opens the gallery/file picker on
// many mobile browsers — `capture` is what asks for the camera, and it
// can't be combined with picking an existing file — so camera and file get
// their own inputs behind an explicit two-option menu.
export function PhotoAddButton({ uploading, onChange }: PhotoAddButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function pick(ref: React.RefObject<HTMLInputElement>) {
    setOpen(false);
    ref.current?.click();
  }

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        type="button"
        disabled={uploading}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-ink-muted disabled:cursor-default"
      >
        {uploading ? (
          <span className="material-symbols-rounded animate-spin text-xl">
            progress_activity
          </span>
        ) : (
          <>
            <span className="material-symbols-rounded text-xl">
              add_photo_alternate
            </span>
            <span className="font-body text-[10px] font-semibold">Add</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-20 flex w-44 flex-col gap-0.5 rounded-2xl border border-border bg-panel p-1.5 shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(cameraRef)}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left font-body text-sm hover:bg-card"
          >
            <span className="material-symbols-rounded text-lg text-brand">
              photo_camera
            </span>
            Take photo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(fileRef)}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left font-body text-sm hover:bg-card"
          >
            <span className="material-symbols-rounded text-lg text-brand">
              upload_file
            </span>
            Choose from files
          </button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        onChange={onChange}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
