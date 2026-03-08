import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    
    // Prevent scrolling when modal is open
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  // Render modal to body avoiding stacking context issues
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity opacity-100" 
        onClick={onCancel}
        aria-hidden="true"
      />
      
      {/* Modal Dialog */}
      <div 
        className="relative bg-bg-surface w-full max-w-sm rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-message"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
      >
        <div className="p-6">
          <h2 id="modal-title" className="text-lg font-semibold text-text-primary mb-2">
            {title}
          </h2>
          <p id="modal-message" className="text-sm text-text-secondary">
            {message}
          </p>
        </div>
        
        <div className="bg-bg-elevated px-6 py-4 flex items-center justify-end gap-3 border-t border-border-subtle">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button 
            variant={isDestructive ? "danger" : "primary"}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
