"use client";

import { useRouter } from "next/navigation";
import type { ScheduleEvent } from "@/lib/schedule-utils";
import { formatTime, isPast } from "@/lib/schedule-utils";

interface EventCardProps {
  event: ScheduleEvent;
  compact?: boolean;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const priorityDot: Record<string, string> = {
  high: "bg-status-high-text",
  normal: "bg-accent-primary",
  low: "bg-text-tertiary",
};

const riskColors: Record<string, string> = {
  HIGH: "bg-status-high-text",
  MED: "bg-status-med-text",
  LOW: "bg-status-low-text",
};

export function ScheduleEventCard({ event, compact, onAccept, onDismiss }: EventCardProps) {
  const router = useRouter();
  const past = isPast(event.start_time) && event.status !== "suggested";
  const isSuggested = event.status === "suggested";
  const isCompleted = event.status === "completed";

  const handleClick = () => {
    if (event.client_id) {
      router.push(`/dashboard/${event.client_id}`);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={`w-full text-left px-2 py-1 rounded-sm text-[11px] leading-tight truncate transition-colors
          ${isSuggested
            ? "border border-dashed border-accent-ai/50 bg-accent-ai/5 text-accent-ai"
            : past || isCompleted
              ? "bg-bg-surface-elevated text-text-tertiary"
              : "bg-accent-primary/10 text-accent-primary border border-accent-primary/20"
          }
          ${event.client_id ? "cursor-pointer hover:opacity-80" : "cursor-default"}
        `}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${priorityDot[event.priority]}`} />
        {event.all_day ? "" : formatTime(event.start_time) + " "}{event.title}
      </button>
    );
  }

  return (
    <div
      className={`group rounded-sm border p-3 transition-all
        ${isSuggested
          ? "border-dashed border-accent-ai/40 bg-accent-ai/5"
          : past || isCompleted
            ? "border-border-subtle bg-bg-surface-elevated opacity-70"
            : "border-border-subtle bg-bg-surface hover:shadow-sm"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          onClick={handleClick}
          className={`flex-1 min-w-0 ${event.client_id ? "cursor-pointer" : ""}`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[event.priority]}`} />
            <span className={`text-sm font-medium truncate ${past || isCompleted ? "text-text-tertiary" : "text-text-primary"}`}>
              {event.title}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-text-tertiary font-mono">
            {!event.all_day && <span>{formatTime(event.start_time)}</span>}
            {event.all_day && <span>All day</span>}
            {event.clients?.name && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${riskColors[event.clients.risk_level] ?? "bg-text-tertiary"}`} />
                  {event.clients.name}
                </span>
              </>
            )}
            {event.source === "ai_extracted" && (
              <>
                <span>·</span>
                <span className="text-accent-ai">AI</span>
              </>
            )}
            {event.source === "google_sync" && (
              <>
                <span>·</span>
                <span className="text-text-tertiary">GCal</span>
              </>
            )}
          </div>

          {event.description && !compact && (
            <p className="text-xs text-text-tertiary mt-1 line-clamp-1">
              {event.description}
            </p>
          )}
        </div>

        {/* Suggested event actions */}
        {isSuggested && onAccept && onDismiss && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(event.id); }}
              className="px-2 py-1 text-[10px] font-medium bg-accent-ai text-white rounded-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Accept
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(event.id); }}
              className="px-2 py-1 text-[10px] font-medium text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
