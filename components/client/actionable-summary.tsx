"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <div className="bg-accent-ai-light p-4 rounded-sm border border-accent-ai/20 shadow-sm relative overflow-hidden flex-1 flex flex-col">
      {/* Decorative accent line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-accent-ai opacity-50" />

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✨</span>
        <span className="font-mono text-xs font-semibold text-accent-ai tracking-wide uppercase flex-1">
          Actionable Summary
        </span>
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
      </div>
      <div className="text-sm text-text-primary leading-relaxed">
        <Markdown content={summary || (
          "*No summary yet — record or upload a case note to generate one.*"
        )} />
      </div>
    </div>
  );
}
