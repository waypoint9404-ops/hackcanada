"use client";

import { useState, useRef } from "react";

interface DocumentUploadProps {
  clientId: string;
  onDocumentProcessed?: (data: {
    note: string | null;
    documentType: string;
    classification: { action: string; reason: string } | null;
    warning?: string;
  }) => void;
}

export function DocumentUpload({ clientId, onDocumentProcessed }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset
    setError(null);
    setStatus(null);
    setUploading(true);

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.");
      setUploading(false);
      return;
    }

    try {
      setStatus("Uploading document...");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setStatus(null);
      onDocumentProcessed?.({
        note: data.note,
        documentType: data.documentType,
        classification: data.classification,
        warning: data.warning,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus(null);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        id={`doc-upload-${clientId}`}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wide border border-border-subtle rounded-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        {uploading ? "Processing..." : "Upload Document"}
      </button>

      {status && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-accent">
          <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {status}
        </div>
      )}

      {error && (
        <p className="text-[11px] font-mono text-status-high-text">{error}</p>
      )}
    </div>
  );
}
