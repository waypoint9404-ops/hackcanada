"use client";

import { useEffect, useState, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEditing = (event: TimelineEvent) => {
    setEditingId(event.id);
    setEditContent(event.content);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, messageId: editingId }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Update the local event content
      setEvents((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, content: editContent } : e))
      );
      setEditingId(null);
      setEditContent("");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        const isExpanded = expanded.has(event.id);

        const cleanContent = isWorkerEdit
          ? event.content.replace(/\[WORKER EDIT[\s\S]*?\]\n*/, '').trim()
          : event.content;

        const isLong = cleanContent.length > 280;

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
                <div className="flex items-center gap-2">
                  {editingId !== event.id && (
                    <button
                      onClick={() => startEditing(event)}
                      className="text-text-tertiary hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Edit note"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  <span className="meta-mono">{formattedDate}</span>
                </div>
              </div>
              
              {editingId === event.id ? (
                <div className="flex flex-col gap-2 mt-1">
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={6}
                    disabled={saving}
                    className="w-full bg-bg-base border border-border-subtle rounded-sm p-2.5 text-[13px] sm:text-sm leading-relaxed text-text-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-2.5 py-1 text-[11px] font-medium bg-text-primary text-bg-surface rounded-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`text-[13px] sm:text-sm text-text-secondary leading-relaxed break-words ${isLong && !isExpanded ? "max-h-[120px] overflow-hidden relative" : ""}`}>
                    <Markdown content={cleanContent} />
                    {isLong && !isExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg-base to-transparent group-hover:from-bg-elevated" />
                    )}
                  </div>

                  {isLong && (
                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="text-[11px] font-mono text-accent hover:underline self-start mt-1 cursor-pointer"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
