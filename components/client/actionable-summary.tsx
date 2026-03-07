"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";

interface ActionableSummaryProps {
  clientId: string;
}

export function ActionableSummary({ clientId }: ActionableSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(`/api/clients/${clientId}/summary`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Failed to fetch summary");
        
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading summary");
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [clientId]);

  if (loading) {
    return (
      <div className="bg-accent-ai-light p-4 rounded-sm border border-accent-ai/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">✨</span>
          <span className="font-mono text-xs font-semibold text-accent-ai tracking-wide uppercase">
            AI Summary Generating
          </span>
        </div>
        <Skeleton lines={4} />
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
    <div className="bg-accent-ai-light p-4 rounded-sm border border-accent-ai/20 shadow-sm relative overflow-hidden">
      {/* Decorative accent line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-accent-ai opacity-50" />
      
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✨</span>
        <span className="font-mono text-xs font-semibold text-accent-ai tracking-wide uppercase">
          Actionable Summary
        </span>
      </div>
      
      <div className="text-sm text-text-primary leading-relaxed">
        <Markdown content={summary ?? ""} />
      </div>
    </div>
  );
}
