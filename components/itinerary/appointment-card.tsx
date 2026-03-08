"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Check, CheckCircle, X, MapPin, Clock, Pencil, Trash2 } from "lucide-react";

interface AppointmentClient {
  id: string;
  name: string;
  risk_level: "HIGH" | "MED" | "LOW";
  tags: string[];
}

interface Appointment {
  id: string;
  client: AppointmentClient;
  title: string;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  source: "ai_extracted" | "manual";
  status: "confirmed" | "tentative" | "dismissed" | "completed";
}

interface AppointmentCardProps {
  appointment: Appointment;
  timezone?: string;
  onConfirm?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (id: string) => void;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  home_visit: "Home Visit",
  court: "Court",
  medical: "Medical",
  phone_call: "Phone Call",
  office: "Office",
  transport: "Transport",
  other: "Other",
};

function formatTime(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

export function AppointmentCard({
  appointment,
  timezone = "America/Toronto",
  onConfirm,
  onDismiss,
  onEdit,
  onDelete,
}: AppointmentCardProps) {
  const isTentative = appointment.status === "tentative";
  const timeStr = formatTime(appointment.starts_at, timezone);
  const endTimeStr = appointment.ends_at
    ? formatTime(appointment.ends_at, timezone)
    : null;

  // Determine if this appointment's time has already passed
  const now = new Date();
  const endTime = appointment.ends_at
    ? new Date(appointment.ends_at)
    : new Date(new Date(appointment.starts_at).getTime() + 60 * 60 * 1000); // default 1hr
  const isPast = endTime < now;

  return (
    <Card
      className={`p-4 ${
        isPast
          ? "bg-green-50/60 border-green-200/60 dark:bg-green-950/20 dark:border-green-800/30"
          : isTentative
            ? "border-dashed border-status-med-text/40 bg-status-med-bg/20"
            : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Time + Details */}
        <div className={`flex-1 min-w-0 ${isPast ? "opacity-70" : ""}`}>
          {/* Time */}
          <div className="flex items-center gap-2 mb-1.5">
            {isPast ? (
              <CheckCircle size={14} className="text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <Clock size={14} className="text-text-tertiary flex-shrink-0" />
            )}
            <span className={`meta-mono ${isPast ? "text-green-700 dark:text-green-400 line-through" : "text-text-secondary"}`}>
              {timeStr}
              {endTimeStr ? ` – ${endTimeStr}` : ""}
            </span>
            {isPast && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded-sm">
                Done
              </span>
            )}
            {isTentative && !isPast && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-status-med-text bg-status-med-bg px-1.5 py-0.5 rounded-sm">
                AI Suggested
              </span>
            )}
          </div>

          {/* Client name + link */}
          <Link
            href={`/dashboard/${appointment.client.id}`}
            className={`font-medium transition-colors ${
              isPast
                ? "text-green-800 dark:text-green-300 line-through decoration-green-400/50"
                : "text-text-primary hover:text-accent"
            }`}
          >
            {appointment.client.name}
          </Link>

          {/* Title + type */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm ${isPast ? "text-green-700/70 dark:text-green-400/70 line-through" : "text-text-secondary"}`}>
              {appointment.title}
            </span>
            <span className="tag-badge text-[10px]">
              {EVENT_TYPE_LABELS[appointment.event_type] || appointment.event_type}
            </span>
          </div>

          {/* Location */}
          {appointment.location && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <MapPin size={12} className="text-text-tertiary flex-shrink-0" />
              <span className="text-xs text-text-tertiary">
                {appointment.location}
              </span>
            </div>
          )}
        </div>

        {/* Right: Risk badge + actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge level={appointment.client.risk_level} />

          {/* Edit/Delete for confirmed appointments */}
          {!isTentative && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(appointment)}
                  className="h-7 w-7 text-text-tertiary hover:text-text-primary"
                >
                  <Pencil size={14} />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(appointment.id)}
                  className="h-7 w-7 text-text-tertiary hover:text-status-high-text"
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tentative action buttons (hidden if past) */}
      {isTentative && !isPast && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
          {onConfirm && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirm(appointment.id)}
              className="flex-1 gap-1.5"
            >
              <Check size={14} /> Confirm
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(appointment.id)}
              className="flex-1 gap-1.5 text-text-tertiary"
            >
              <X size={14} /> Dismiss
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
