"use client";

import { useEffect, useCallback, ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  centered?: boolean;
}

export function Modal({ open, onClose, children, title, centered }: ModalProps) {
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
      <div
        className="fixed inset-0 bg-[rgba(28,27,26,0.4)] backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`fixed z-50 bg-bg-surface rounded-xl shadow-[var(--shadow-float)] w-[calc(100%-2rem)] max-w-md overflow-y-auto max-h-[85dvh] ${
          centered
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : "bottom-4 left-1/2 -translate-x-1/2"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-serif font-medium text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none cursor-pointer"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}

        <div className="px-5 pb-6">{children}</div>
      </div>
    </>
  );
}
