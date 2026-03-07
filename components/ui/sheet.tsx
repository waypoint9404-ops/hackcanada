"use client";

import { useEffect, useCallback, ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Sheet({ open, onClose, children, title }: SheetProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="sheet-overlay" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div
        className={`sheet-content ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border-subtle" />
        </div>

        {title && (
          <div className="px-5 pb-3 border-b border-border-subtle">
            <h2 className="text-base font-medium text-text-primary">{title}</h2>
          </div>
        )}

        <div className="p-5">{children}</div>
      </div>
    </>
  );
}
