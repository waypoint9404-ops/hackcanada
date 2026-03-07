"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";

interface ActionableSummaryProps {
  clientId: string;
  refreshKey?: number;
}

export function ActionableSummary({ clientId, refreshKey }: ActionableSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchSummary = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const url = `/api/clients/${clientId}/summary`;
      const options = refresh ? { method: "POST" } : {};
      const res = await fetch(url, options);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch summary");
      
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading summary");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, refreshKey]);

  if (loading) {
    return (
      <div className="bg-accent-ai-light p-4 rounded-sm border border-accent-ai/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">✨</span>
          <span className="font-mono text-xs font-semibold text-accent-ai tracking-wide uppercase">
            Actionable Summary
          </span>
        </div>
        <Skeleton lines={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-status-high-bg text-status-high-text p-4 rounded-sm border border-status-high-bg/50">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const startEditing = () => {
    setEditContent(summary ?? "");
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditContent("");
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: editContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      setSummary(editContent);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-accent-ai-light p-4 rounded-sm border border-accent-ai/20 shadow-sm relative overflow-hidden">
      {/* Decorative accent line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-accent-ai opacity-50" />

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✨</span>
        <span className="font-mono text-xs font-semibold text-accent-ai tracking-wide uppercase flex-1">
          Actionable Summary
        </span>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSummary(true)}
              disabled={refreshing}
              className="text-accent-ai/60 hover:text-accent-ai transition-colors cursor-pointer disabled:opacity-40"
              title="Regenerate AI summary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? "animate-spin" : ""}>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <button
              onClick={startEditing}
              className="text-accent-ai/60 hover:text-accent-ai transition-colors cursor-pointer"
              title="Edit summary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={10}
            disabled={saving}
            className="w-full bg-bg-base border border-border-subtle rounded-sm p-3 text-sm leading-relaxed text-text-primary focus:outline-none focus:border-accent-ai focus:ring-1 focus:ring-accent-ai resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-accent-ai text-white rounded-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-text-primary leading-relaxed">
          <Markdown content={summary || (
            "*No summary yet — record or upload a case note to generate one.*"
          )} />
        </div>
      )}
    </div>
  );
}
