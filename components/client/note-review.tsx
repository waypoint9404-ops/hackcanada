"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface NoteReviewProps {
  clientId: string;
  initialNote: string;
  initialTags?: string[];
  initialRisk?: "LOW" | "MED" | "HIGH";
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_TAGS = [
  "HOUSING", "MENTAL_HEALTH", "SUBSTANCE_USE", 
  "EMPLOYMENT", "LEGAL", "MEDICAL", "CRISIS"
];

export function NoteReviewModal({
  clientId,
  initialNote,
  initialTags = [],
  initialRisk = "LOW",
  open,
  onClose,
  onSuccess
}: NoteReviewProps) {
  const [content, setContent] = useState(initialNote);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [risk, setRisk] = useState(initialRisk);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, tags, risk_level: risk }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save note");

      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error saving to Backboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={() => !saving && onClose()} title="Review & Finalize AI Note">
      <div className="flex flex-col gap-5">
        
        {/* Note Content Editor */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary flex justify-between items-center">
            <span>Case Note</span>
            <span className="text-[10px] font-mono bg-accent-ai-light text-accent-ai px-2 py-0.5 rounded-sm uppercase tracking-wide">
              AI Generated
            </span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="w-full bg-bg-base border border-border-subtle rounded-sm p-3 text-sm leading-relaxed text-text-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong resize-none whitespace-pre-wrap"
            disabled={saving}
          />
        </div>

        {/* Tags Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">Related Tags</label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map(tag => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-wide border transition-colors ${
                    selected 
                      ? "bg-text-primary border-text-primary text-bg-surface" 
                      : "bg-bg-surface border-border-subtle text-text-tertiary hover:border-border-strong"
                  }`}
                >
                  {tag.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Risk Level */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">Assigned Risk Level</label>
          <div className="flex gap-2">
            {(["LOW", "MED", "HIGH"] as const).map(level => {
              const selected = risk === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRisk(level)}
                  disabled={saving}
                  className={`flex-1 py-2 rounded-sm font-mono text-xs font-semibold focus:outline-none transition-colors border ${
                    selected
                      ? level === "HIGH" ? "bg-status-high-bg text-status-high-text border-status-high-bg" :
                        level === "MED" ? "bg-status-med-bg text-status-med-text border-status-med-bg" :
                        "bg-status-low-bg text-status-low-text border-status-low-bg"
                      : "bg-bg-surface border-border-subtle text-text-tertiary opacity-60 hover:opacity-100"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs text-status-high-text mt-2">{error}</p>}

        <div className="flex gap-3 mt-4 pt-4 border-t border-border-subtle">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" className="flex-2 w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save to Case History"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
