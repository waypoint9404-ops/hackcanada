"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar as CalIcon, RefreshCw } from "lucide-react";
import type { ScheduleEvent } from "@/lib/schedule-utils";
import { ScheduleEventCard } from "@/components/schedule/event-card";

type CalView = "week" | "month" | "agenda";

export default function SchedulePage() {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [calView, setCalView] = useState<CalView>("week");
  const [iframeKey, setIframeKey] = useState(0); // force iframe reload after sync

  // Fetch Google status + AI suggestions
  const fetchData = useCallback(async () => {
    try {
      const [googleRes, schedRes] = await Promise.all([
        fetch("/api/google"),
        fetch("/api/schedule?status=suggested"),
      ]);

      if (googleRes.ok) {
        const g = await googleRes.json();
        setGoogleConnected(g.connected);
        setGoogleEmail(g.email ?? null);
      }

      if (schedRes.ok) {
        const s = await schedRes.json();
        setSuggestions((s.events ?? []).filter((e: ScheduleEvent) => e.status === "suggested"));
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Accept → push to Google Calendar with grape color, then refresh iframe
  const handleAccept = async (id: string) => {
    try {
      const res = await fetch(`/api/schedule/${id}/accept`, { method: "POST" });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((e) => e.id !== id));
        // Reload iframe to show the newly-created Google Calendar event
        setIframeKey((k) => k + 1);
      }
    } catch {
      /* non-fatal */
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/schedule/${id}/dismiss`, { method: "POST" });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      /* non-fatal */
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/schedule/sync", { method: "POST" });
      setIframeKey((k) => k + 1); // reload iframe
    } catch {
      /* non-fatal */
    }
    setSyncing(false);
  };

  // Build the Google Calendar iframe embed URL
  const getIframeSrc = () => {
    const src = encodeURIComponent(googleEmail ?? "primary");
    const mode = calView === "agenda" ? "AGENDA" : calView === "month" ? "MONTH" : "WEEK";
    return `https://calendar.google.com/calendar/embed?src=${src}&mode=${mode}&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=1&wkst=1`;
  };

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <header className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="heading-display text-4xl text-text-primary">Schedule</h1>
          <div className="flex items-center gap-1">
            {googleConnected && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="p-2 text-text-tertiary hover:text-accent-primary transition-colors cursor-pointer disabled:opacity-50"
                title="Sync with Google Calendar"
              >
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              </button>
            )}
          </div>
        </div>

        {/* View toggle for iframe */}
        {googleConnected && (
          <div className="flex bg-bg-surface border border-border-subtle rounded-sm p-0.5 w-fit">
            {(["week", "month", "agenda"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setCalView(v)}
                className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                  calView === v
                    ? "bg-bg-surface-elevated text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* AI Suggestions banner — visible even without Google Calendar */}
      {suggestions.length > 0 && (
        <div className="mb-4 p-3 rounded-sm border border-dashed border-accent-ai/40 bg-accent-ai/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-accent-ai flex items-center gap-1.5">
              <CalIcon size={12} />
              {suggestions.length} AI suggestion{suggestions.length > 1 ? "s" : ""} detected
            </span>
            <span className="text-[9px] font-mono text-text-tertiary">
              Accept to add to your calendar
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {suggestions.slice(0, 5).map((e) => (
              <ScheduleEventCard
                key={e.id}
                event={e}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
              />
            ))}
            {suggestions.length > 5 && (
              <span className="text-[10px] font-mono text-accent-ai text-center">
                +{suggestions.length - 5} more
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-accent-ai/20">
            <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#7986CB" }} />
              <span>AI events appear in <strong>grape</strong> color in your Google Calendar</span>
            </div>
          </div>
        </div>
      )}

      {/* Google Calendar embed */}
      {loading ? (
        <div className="py-16 text-center text-text-tertiary text-sm">Loading schedule...</div>
      ) : googleConnected ? (
        <div className="rounded-sm border border-border-subtle overflow-hidden bg-white">
          <iframe
            key={iframeKey}
            src={getIframeSrc()}
            className="w-full border-0"
            style={{ height: "calc(100vh - 300px)", minHeight: "480px" }}
            title="Google Calendar"
          />
        </div>
      ) : (
        /* Not connected state */
        <div className="rounded-sm border border-border-subtle bg-bg-surface p-8 text-center">
          <CalIcon size={32} className="mx-auto mb-3 text-text-tertiary" />
          <h2 className="text-sm font-medium text-text-primary mb-1">Connect Google Calendar</h2>
          <p className="text-xs text-text-secondary mb-4 max-w-xs mx-auto">
            Link your Google account to see your calendar here. AI-detected dates from case notes will appear as
            suggestions above, ready to add with one tap.
          </p>
          <a
            href="/api/google/auth?returnTo=/schedule"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-bg-base border border-border-subtle rounded-sm hover:bg-bg-surface-elevated transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Link Google Account
          </a>

          {suggestions.length === 0 && (
            <p className="text-[10px] text-text-tertiary mt-4">
              AI suggestions from your case notes will still appear here without Google Calendar.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
