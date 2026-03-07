"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import dynamic from "next/dynamic";
import { marked } from "marked";
import TurndownService from "turndown";

const WysiwygEditor = dynamic(() => import("react-simple-wysiwyg"), { ssr: false });

interface CaseNoteEntry {
  id: string;
  ai_note: string;
  raw_transcript: string | null;
  timestamp: string | null;
  is_worker_edit: boolean;
  source?: "call" | "document";
  document_filename?: string;
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

  // Expansion: only one card expanded at a time (full-width takeover)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Editing mode within the expanded card
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Raw transcript visibility
  const [transcriptVisible, setTranscriptVisible] = useState(false);

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/timeline`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response");
      }
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

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      const entry = entries.find(e => e.id === expandedId);
      if (entry && isEditing && isDirty(entry)) {
         if (window.confirm("You have unsaved changes. Do you want to save them now?")) {
            handleSave(entry.id);
            return;
         }
      }
      // Collapse
      setExpandedId(null);
      setIsEditing(false);
      setEditContent("");
      setTranscriptVisible(false);
      setSaveError(null);
    } else {
      if (expandedId && isEditing) {
         const oldEntry = entries.find(e => e.id === expandedId);
         if (oldEntry && isDirty(oldEntry)) {
            if (!window.confirm("You have unsaved changes in the open note. Discard them?")) {
               return; // cancel expansion change
            }
         }
      }
      setExpandedId(id);
      setIsEditing(false);
      setEditContent("");
      setTranscriptVisible(false);
      setSaveError(null);
    }
  };

  const startEditing = async (entry: CaseNoteEntry) => {
    setIsEditing(true);
    // Convert Markdown to HTML for the WYSIWYG editor
    const htmlVal = await marked.parse(entry.ai_note);
    setEditContent(htmlVal as string);
  };

  const cancelEditing = (entry: CaseNoteEntry) => {
    setIsEditing(false);
    setEditContent("");
    setSaveError(null);
  };

  const isDirty = (entry: CaseNoteEntry) => {
    if (!isEditing || !editContent) return false;
    const turndownService = new TurndownService({ headingStyle: "atx", bulletListMarker: "*" });
    const currentMarkdown = turndownService.turndown(editContent);
    return currentMarkdown.trim() !== entry.ai_note.trim();
  };

  const handleClickOutside = (entry: CaseNoteEntry) => {
    if (!isEditing) return;
    
    if (isDirty(entry)) {
      if (window.confirm("You have unsaved changes. Do you want to save them now?")) {
        handleSave(entry.id);
      } else {
        cancelEditing(entry);
      }
    } else {
      cancelEditing(entry);
    }
  };

  const handleSave = async (id: string) => {
    if (!editContent.trim()) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    // Convert HTML back to clean Markdown
    const turndownService = new TurndownService({ headingStyle: "atx", bulletListMarker: "*" });
    const markdownContent = turndownService.turndown(editContent);

    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: markdownContent, messageId: id }),
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Invalid response from server");
      }

      if (!res.ok) throw new Error(data.error || "Failed to save");

      setSaveSuccess(id);
      setIsEditing(false);
      setEditContent("");
      setTimeout(() => setSaveSuccess(null), 2500);

      // Update the local entry optimistically
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ai_note: markdownContent, is_worker_edit: true } : e))
      );

      onNoteEdited?.();
    } catch (err) {
      console.error("[Timeline] Save failed:", err);
      setSaveError(err instanceof Error ? err.message : "Error saving note");
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

  // Backboard returns UTC timestamps that may lack a 'Z' suffix.
  // Ensure they're parsed as UTC so toLocale* methods convert to local time correctly.
  const parseUTC = (ts: string): Date => {
    // If the string already has timezone info (Z, +, or -offset), parse as-is
    if (/Z|[+-]\d{2}:\d{2}$/.test(ts)) return new Date(ts);
    // Otherwise append Z to force UTC interpretation
    return new Date(ts + "Z");
  };

  const formatDate = (ts: string | null) => {
    if (!ts) return "\u2014";
    const d = parseUTC(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "";
    const d = parseUTC(ts);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  // ── Expanded: full-width card takeover ────────────────────────────────────
  if (expandedId) {
    const entry = entries.find((e) => e.id === expandedId);
    if (!entry) {
      setExpandedId(null);
      return null;
    }

    const dirty = isDirty(entry);
    const justSaved = saveSuccess === entry.id;

    return (
      <div className="note-card note-card-expanded-full">
        {/* Card header — same as compact cards */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {entry.is_worker_edit ? (
                <span className="text-accent font-semibold flex items-center gap-1">
                  <span>✏️</span> Edited Note
                </span>
              ) : (
                <span className="text-accent-ai font-semibold">AI Note</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Close button */}
            <button
              onClick={() => handleExpand(entry.id)}
              className="w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-text-primary rounded-sm hover:bg-bg-elevated transition-colors cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
            {justSaved && (
              <span className="text-[11px] font-mono text-status-low-text flex items-center gap-1">
                <span>✓</span> Saved
              </span>
            )}
            {dirty && !saving && (
              <button
                onClick={() => cancelEditing(entry)}
                className="text-[11px] font-mono text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
              >
                Discard
              </button>
            )}
            {dirty && (
              <button
                onClick={() => handleSave(entry.id)}
                disabled={saving}
                className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide bg-accent text-white rounded-sm hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            )}
            <span className="meta-mono text-[10px]">
              {formatDate(entry.timestamp)}
              {formatTime(entry.timestamp) && (
                <span className="ml-1 opacity-60">{formatTime(entry.timestamp)}</span>
              )}
            </span>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="mb-3 p-2 bg-status-high-bg border border-status-high-text/20 rounded-sm">
            <p className="text-xs text-status-high-text">{saveError}</p>
          </div>
        )}

        {/* Note content — rendered markdown OR seamless edit textarea */}
        {isEditing ? (
          <div className="w-full bg-white mb-4 rounded-sm border border-border-subtle shadow-sm overflow-hidden">
             <WysiwygEditor
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={() => handleClickOutside(entry)}
                containerProps={{ style: { border: 'none', minHeight: '200px' } }}
             />
          </div>
        ) : (
          <div
            className="text-[13px] sm:text-sm text-text-secondary leading-relaxed break-words cursor-text"
            onClick={() => startEditing(entry)}
          >
            <div className="markdown-content">
              <ReactMarkdown>{entry.ai_note}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border-subtle">
          {!isEditing && (
            <button
              onClick={() => startEditing(entry)}
              className="text-[11px] font-mono text-accent-ai hover:underline cursor-pointer transition-colors"
            >
              ✏️ Edit
            </button>
          )}

          {entry.raw_transcript && (
            <button
              onClick={() => setTranscriptVisible((v) => !v)}
              className="text-[11px] font-mono text-text-tertiary hover:text-text-secondary hover:underline cursor-pointer transition-colors"
            >
              {transcriptVisible ? "Hide Transcript" : "View Raw Transcript"}
            </button>
          )}
        </div>

        {/* Raw Transcript */}
        {transcriptVisible && entry.raw_transcript && (
          <div className="mt-3 p-3 bg-bg-elevated rounded-sm border border-border-subtle">
            <span className="text-[9px] font-mono uppercase tracking-widest text-text-tertiary block mb-2">
              Raw Transcript
            </span>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {entry.raw_transcript}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Compact card scroll view ──────────────────────────────────────────────
  return (
    <div className="case-history-container">
      <div className="case-history-scroll">
        {entries.map((entry) => {
          const justSaved = saveSuccess === entry.id;
          const isLong = entry.ai_note.length > 200;

          return (
            <div
              key={entry.id}
              className={`note-card ${justSaved ? "note-card-saved" : ""}`}
              onClick={() => handleExpand(entry.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider">
                  {entry.is_worker_edit ? (
                    <span className="text-accent font-semibold flex items-center gap-1">
                      <span>✏️</span> Edited Note
                    </span>
                  ) : entry.source === "document" ? (
                    <span className="text-accent-ai font-semibold flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {entry.document_filename ? `Doc: ${entry.document_filename}` : "Document Note"}
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

              {/* Note content — rendered markdown, truncated */}
              <div
                className={`text-[13px] sm:text-sm text-text-secondary leading-relaxed break-words ${
                  isLong ? "note-content-collapsed" : ""
                }`}
              >
                <div className="markdown-content">
                  <ReactMarkdown>{entry.ai_note}</ReactMarkdown>
                </div>
                {isLong && <div className="note-fade-overlay" />}
              </div>



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
