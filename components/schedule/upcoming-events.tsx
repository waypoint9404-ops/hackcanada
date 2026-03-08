"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import type { ScheduleEvent } from "@/lib/schedule-utils";
import { formatTime, formatDate } from "@/lib/schedule-utils";

interface UpcomingEventsProps {
  clientId: string;
  refreshKey?: number;
}

const priorityDot: Record<string, string> = {
  high: "bg-status-high-text",
  normal: "bg-accent-primary",
  low: "bg-text-tertiary",
};

export function UpcomingEvents({ clientId, refreshKey }: UpcomingEventsProps) {
  const router = useRouter();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date().toISOString();
        const res = await fetch(
          `/api/schedule?clientId=${clientId}&start=${encodeURIComponent(now)}&status=active`
        );
        if (res.ok) {
          const data = await res.json();
          setEvents((data.events ?? []).slice(0, 3));
        }
      } catch { /* non-fatal */ }
      setLoading(false);
    })();
  }, [clientId, refreshKey]);

  if (loading || events.length === 0) return null;

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase text-text-tertiary tracking-wider flex items-center gap-1">
          <Calendar size={10} />
          Upcoming
        </span>
        <button
          onClick={() => router.push("/schedule")}
          className="text-[10px] font-mono text-accent-primary hover:underline cursor-pointer"
        >
          View all
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => router.push("/schedule")}
            className={`w-full text-left px-2.5 py-1.5 rounded-sm text-xs leading-tight transition-colors cursor-pointer
              ${e.status === "suggested"
                ? "border border-dashed border-accent-ai/40 bg-accent-ai/5 text-accent-ai"
                : "bg-bg-surface-elevated text-text-primary hover:bg-bg-surface-elevated/80"
              }
            `}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[e.priority]}`} />
              <span className="truncate font-medium">{e.title}</span>
            </div>
            <div className="text-[10px] text-text-tertiary font-mono mt-0.5 ml-3">
              {formatDate(new Date(e.start_time))}
              {!e.all_day && ` · ${formatTime(e.start_time)}`}
              {e.status === "suggested" && " · AI suggested"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
