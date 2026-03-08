"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CalendarDays, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentCard } from "@/components/itinerary/appointment-card";

import { MorningBriefing } from "@/components/itinerary/morning-briefing";
import { AddAppointmentSheet } from "@/components/itinerary/add-appointment-sheet";

interface AppointmentData {
  id: string;
  client: {
    id: string;
    name: string;
    risk_level: "HIGH" | "MED" | "LOW";
    tags: string[];
  };
  title: string;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  source: "ai_extracted" | "manual";
  status: "confirmed" | "tentative" | "dismissed" | "completed";
}



export default function TodayPage() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [todayDate, setTodayDate] = useState("");
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prefillClientId, setPrefillClientId] = useState<string | undefined>();
  const [prefillClientName, setPrefillClientName] = useState<string | undefined>();

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fetchAppointments = useCallback(async () => {
    setLoadingAppts(true);
    try {
      const res = await fetch(`/api/itinerary/today?timezone=${encodeURIComponent(tz)}`);
      const data = await res.json();
      if (data.appointments) setAppointments(data.appointments);
      if (data.date) setTodayDate(data.date);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setLoadingAppts(false);
    }
  }, [tz]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const refreshAll = () => {
    fetchAppointments();
  };

  // Appointment actions
  const handleConfirm = async (id: string) => {
    try {
      await fetch(`/api/itinerary/appointments/${id}/confirm`, { method: "POST" });
      refreshAll();
    } catch (err) {
      console.error("Confirm failed:", err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/itinerary/appointments/${id}/dismiss`, { method: "POST" });
      refreshAll();
    } catch (err) {
      console.error("Dismiss failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this appointment?")) return;
    try {
      await fetch(`/api/itinerary/appointments/${id}`, { method: "DELETE" });
      refreshAll();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleAddNew = () => {
    setPrefillClientId(undefined);
    setPrefillClientName(undefined);
    setSheetOpen(true);
  };

  // Format today's date for display
  const formattedDate = todayDate
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(todayDate + "T12:00:00"))
    : "";

  const allAppts = [...appointments].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <main className="px-5 py-8 max-w-lg mx-auto pb-24">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="heading-display text-4xl text-text-primary">Today</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshAll}
            className="h-9 w-9 text-text-tertiary"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
        {formattedDate && (
          <p className="text-sm text-text-secondary">{formattedDate}</p>
        )}
      </header>

      {/* Morning Briefing */}
      <section className="mb-8">
        <MorningBriefing timezone={tz} />
      </section>

      {/* Today's Schedule */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={16} className="text-text-tertiary" />
          <h2 className="meta-mono text-text-secondary uppercase tracking-widest text-xs">
            Today&apos;s Schedule
          </h2>
          <span className="meta-mono text-text-tertiary text-xs">
            ({allAppts.length})
          </span>
        </div>

        {loadingAppts ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : allAppts.length === 0 ? (
          <Card className="p-6 text-center">
            <CalendarDays
              size={32}
              className="text-text-tertiary mx-auto mb-3"
            />
            <p className="text-sm text-text-secondary mb-1">
              No appointments scheduled for today.
            </p>
            <p className="text-xs text-text-tertiary">
              Record a visit note with future plans to auto-populate your
              schedule.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {allAppts.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                timezone={tz}
                onConfirm={appt.status === "tentative" ? handleConfirm : undefined}
                onDismiss={appt.status === "tentative" ? handleDismiss : undefined}
                onDelete={appt.status === "confirmed" ? handleDelete : undefined}
              />
            ))}
          </div>
        )}

        {/* Add appointment button */}
        <Button
          variant="secondary"
          size="md"
          onClick={handleAddNew}
          className="w-full mt-3 gap-2"
        >
          <Plus size={16} /> Add Appointment
        </Button>
      </section>

      {/* Add Appointment Sheet */}
      <AddAppointmentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={refreshAll}
        prefillClientId={prefillClientId}
        prefillClientName={prefillClientName}
      />
    </main>
  );
}
