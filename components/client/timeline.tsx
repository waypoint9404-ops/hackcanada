"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";

interface CaseNoteEntry {
  id: string;
  ai_note: string;
  raw_transcript: string | null;
  timestamp: string | null;
  is_worker_edit: boolean;
}

interface TimelineProps {
  clientId: string;
  onNoteEdited?: () => void;
  refreshKey?: number;
}

export function Timeline({ clientId, onNoteEdited, refreshKey }: TimelineProps) {
  const [entries, setEntries] = useState<CaseNoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Expand/collapse state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Raw transcript visibility
  const [transcriptVisible, setTranscriptVisible] = useState<Set<string>>(new Set());

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/timeline`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch timeline");

      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading timeline");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline, refreshKey]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also close transcript and cancel edit when collapsing
        setTranscriptVisible((tv) => {
          const n = new Set(tv);
          n.delete(id);
          return n;
        });
        if (editingId === id) {
          setEditingId(null);
          setEditContent("");
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTranscript = (id: string) => {
    setTranscriptVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (entry: CaseNoteEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.ai_note);
    // Make sure it's expanded
    setExpandedIds((prev) => new Set(prev).add(entry.id));
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSave = async () => {
    if (!editingId || !editContent.trim()) return;

    setSaving(true);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, messageId: editingId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setSaveSuccess(editingId);
      setEditingId(null);
      setEditContent("");

      // Clear success animation after a moment
      setTimeout(() => setSaveSuccess(null), 2000);

      // Refresh timeline to show the edit
      await fetchTimeline();

      // Notify parent to refresh summary
      onNoteEdited?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error saving note");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="note-card p-4">
            <Skeleton lines={3} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-status-high-text py-4">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-8 text-center italic">
        No case history recorded yet.
      </p>
    );
  }

  const formatDate = (ts: string | null) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="case-history-container">
      <div className="case-history-scroll">
        {entries.map((entry) => {
          const isExpanded = expandedIds.has(entry.id);
          const isEditing = editingId === entry.id;
          const showTranscript = transcriptVisible.has(entry.id);
          const justSaved = saveSuccess === entry.id;
          const isLong = entry.ai_note.length > 200;

          return (
            <div
              key={entry.id}
              className={`note-card ${isExpanded ? "note-card-expanded" : ""} ${justSaved ? "note-card-saved" : ""}`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider">
                  {entry.is_worker_edit ? (
                    <span className="text-accent font-semibold flex items-center gap-1">
                      <span>✏️</span> Edited Note
                    </span>
                  ) : (
                    <span className="text-accent-ai font-semibold">AI Note</span>
                  )}
                </span>
                <span className="meta-mono text-[10px]">
                  {formatDate(entry.timestamp)}
                  {formatTime(entry.timestamp) && (
                    <span className="ml-1 opacity-60">{formatTime(entry.timestamp)}</span>
                  )}
                </span>
              </div>

              {/* Note content */}
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    disabled={saving}
                    className="w-full bg-bg-base border border-border-subtle rounded-sm p-3 text-sm leading-relaxed text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none whitespace-pre-wrap transition-colors"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 py-2 text-xs font-mono uppercase tracking-wide border border-border-subtle rounded-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !editContent.trim()}
                      className="flex-[2] py-2 text-xs font-mono uppercase tracking-wide bg-accent text-white rounded-sm hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`text-[13px] sm:text-sm text-text-secondary leading-relaxed break-words ${
                    isLong && !isExpanded ? "note-content-collapsed" : ""
                  }`}
                >
                  <Markdown content={entry.ai_note} />
                  {isLong && !isExpanded && (
                    <div className="note-fade-overlay" />
                  )}
                </div>
              )}

              {/* Action bar */}
              {!isEditing && (
                <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border-subtle">
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="text-[11px] font-mono text-accent hover:underline cursor-pointer transition-colors"
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>

                  {isExpanded && (
                    <>
                      <button
                        onClick={() => startEdit(entry)}
                        className="text-[11px] font-mono text-accent-ai hover:underline cursor-pointer transition-colors"
                      >
                        ✏️ Edit
                      </button>

                      {entry.raw_transcript && (
                        <button
                          onClick={() => toggleTranscript(entry.id)}
                          className="text-[11px] font-mono text-text-tertiary hover:text-text-secondary hover:underline cursor-pointer transition-colors"
                        >
                          {showTranscript ? "Hide Transcript" : "View Raw Transcript"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Raw Transcript (nested, toggled) */}
              {isExpanded && showTranscript && entry.raw_transcript && (
                <div className="mt-3 p-3 bg-bg-elevated rounded-sm border border-border-subtle">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-text-tertiary block mb-2">
                    Raw Transcript
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {entry.raw_transcript}
                  </p>
                </div>
              )}

              {/* Save success indicator */}
              {justSaved && (
                <div className="mt-2 text-[11px] font-mono text-status-low-text flex items-center gap-1">
                  <span>✓</span> Saved — summary updating
                </div>

              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
