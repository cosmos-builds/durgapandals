"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<Toast["tone"], string> = {
  success: "border-[rgba(127,217,154,.4)] text-[#7FD99A]",
  error: "border-brand/40 text-brand",
};

const TONE_ICON: Record<Toast["tone"], string> = {
  success: "check_circle",
  error: "error",
};

const AUTO_DISMISS_MS = 4000;

// Small in-house toast, matching the rest of the codebase's "hand-rolled
// Tailwind + @durgapandals/ui" approach rather than pulling in a library —
// admin/web previously had zero success/failure feedback for any save,
// delete, or submit action, so a failed request looked identical to one
// that silently did nothing.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast["tone"], message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: useCallback((message: string) => push("success", message), [push]),
    error: useCallback((message: string) => push("error", message), [push]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              role="status"
              layout
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border bg-panel px-4 py-3 font-body text-sm font-semibold shadow-2xl ${TONE_CLASSES[toast.tone]}`}
            >
              <span className="material-symbols-rounded text-lg">{TONE_ICON[toast.tone]}</span>
              <span className="flex-1 text-ink">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="material-symbols-rounded text-base text-ink-muted"
              >
                close
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
