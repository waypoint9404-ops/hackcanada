"use client";

import { useState, useEffect } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface AddAppointmentSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-fill with a client (e.g., from suggestions) */
  prefillClientId?: string;
  prefillClientName?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

const EVENT_TYPES = [
  { value: "home_visit", label: "Home Visit" },
  { value: "court", label: "Court" },
  { value: "medical", label: "Medical" },
  { value: "phone_call", label: "Phone Call" },
  { value: "office", label: "Office Meeting" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

export function AddAppointmentSheet({
  open,
  onClose,
  onCreated,
  prefillClientId,
  prefillClientName,
}: AddAppointmentSheetProps) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(prefillClientId || "");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("home_visit");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients for dropdown
  useEffect(() => {
    if (!open) return;
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (data.clients) {
          setClients(data.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(console.error);
  }, [open]);

  // Update prefill when props change
  useEffect(() => {
    if (prefillClientId) setClientId(prefillClientId);
  }, [prefillClientId]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setTitle(prefillClientName ? `Visit with ${prefillClientName}` : "");
      setEventType("home_visit");
      setStartsAt("");
      setLocation("");
      setNotes("");
      setError(null);
    }
  }, [open, prefillClientName]);

  const handleSubmit = async () => {
    if (!clientId || !title.trim() || !startsAt) {
      setError("Client, title, and date/time are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/itinerary/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          eventType,
          startsAt: new Date(startsAt).toISOString(),
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create appointment");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-bg-surface border border-border-subtle rounded-sm px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors";
  const labelClass = "text-xs font-mono uppercase tracking-widest text-text-tertiary mb-1.5";

  return (
    <Sheet open={open} onClose={onClose} title="Add Appointment">
      <div className="flex flex-col gap-4">
        {/* Client select */}
        <div>
          <label className={labelClass}>Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className={labelClass}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Welfare check, Court transport"
            className={inputClass}
          />
        </div>

        {/* Event Type */}
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className={inputClass}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date/Time */}
        <div>
          <label className={labelClass}>Date & Time</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Location */}
        <div>
          <label className={labelClass}>Location (optional)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., 123 Main St, Community Clinic"
            className={inputClass}
          />
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this visit..."
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        {error && (
          <p className="text-xs text-status-high-text">{error}</p>
        )}

        <div className="flex gap-3 mt-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Creating..." : "Create Appointment"}
          </Button>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
