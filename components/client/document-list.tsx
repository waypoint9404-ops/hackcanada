"use client";

import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType: string;
  aiSummary: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

interface DocumentListProps {
  clientId: string;
  refreshKey?: number;
}

const TYPE_LABELS: Record<string, string> = {
  eviction_letter: "Eviction",
  court_notice: "Court",
  medical_record: "Medical",
  benefit_statement: "Benefits",
  police_report: "Police",
  shelter_form: "Shelter",
  agency_report: "Agency",
  other: "Document",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DocumentList({ clientId, refreshKey }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/documents`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch documents");
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading documents");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

  const handleDelete = async (docId: string) => {
    if (deletingId) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="note-card p-3">
            <Skeleton lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-status-high-text py-2">{error}</p>;
  }

  if (documents.length === 0) {
    return (
      <p className="text-[11px] text-text-tertiary font-mono py-3 text-center">
        No documents uploaded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="note-card p-3 flex items-start gap-3"
        >
          {/* File icon */}
          <div className="flex-shrink-0 mt-0.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-tertiary"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-text-primary truncate">
                {doc.filename}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-elevated text-text-tertiary flex-shrink-0">
                {TYPE_LABELS[doc.documentType] || doc.documentType}
              </span>
            </div>

            {doc.aiSummary && (
              <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2 mb-1">
                {doc.aiSummary}
              </p>
            )}

            <div className="flex items-center gap-3 text-[10px] font-mono text-text-tertiary">
              <span>{formatDate(doc.createdAt)}</span>
              <span>{formatFileSize(doc.fileSizeBytes)}</span>
              {doc.downloadUrl && (
                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline cursor-pointer"
                >
                  Download
                </a>
              )}
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="text-text-tertiary hover:text-status-high-text transition-colors cursor-pointer disabled:opacity-50"
              >
                {deletingId === doc.id ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
