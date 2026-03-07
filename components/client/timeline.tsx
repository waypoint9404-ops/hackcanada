"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineEvent {
  id: string;
  role: string;
  content: string;
  timestamp?: string;
  tokens?: number;
}

interface TimelineProps {
  clientId: string;
}

export function Timeline({ clientId }: TimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/clients/${clientId}/timeline`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Failed to fetch timeline");
        
        // Filter out system prompts or irrelevant messages if needed
        const visibleEvents = (data.events || []).filter(
          (e: TimelineEvent) => e.role !== "system"
        );
        
        setEvents(visibleEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading timeline");
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="w-px bg-border-subtle shrink-0 relative top-2 -mb-8 ml-2" />
            <div className="w-full flex flex-col gap-2 pb-2">
              <Skeleton lines={2} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-status-high-text py-4">{error}</p>;
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-8 text-center italic">
        No case history recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col mt-4">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        const date = event.timestamp ? new Date(event.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const isWorkerEdit = event.content.includes("[WORKER EDIT");
        
        return (
          <div key={event.id} className="group flex gap-4 pr-2 hover:bg-bg-elevated -ml-4 pl-4 py-2 rounded-sm transition-colors">
            {/* Timeline line & dot */}
            <div className="flex flex-col items-center shrink-0 w-4">
              <div className={`w-2 h-2 rounded-full mt-1.5 ${isWorkerEdit ? 'bg-accent border border-white' : 'bg-border-strong'}`} />
              {!isLast && <div className="w-[1px] h-full bg-border-subtle mt-2 group-hover:bg-border-strong transition-colors" />}
            </div>
            
            {/* Content block */}
            <div className="flex-1 flex flex-col gap-1 pb-6 w-[calc(100%-2rem)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                  {isWorkerEdit ? (
                    <span className="text-accent font-semibold flex items-center gap-1">
                      <span>✏️</span> Worker Edit
                    </span>
                  ) : (
                    event.role === "user" ? "Raw Input" : "AI Note"
                  )}
                </span>
                <span className="meta-mono">{formattedDate}</span>
              </div>
              
              <div className="text-[13px] sm:text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words">
                {isWorkerEdit 
                  ? event.content.replace(/\[WORKER EDIT[\s\S]*?\]\n*/, '').trim()
                  : event.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
