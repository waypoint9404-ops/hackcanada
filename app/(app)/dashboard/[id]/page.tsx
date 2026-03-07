"use client";

import { use, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { StatusBadge, TagBadge } from "@/components/ui/badge";
import { ActionableSummary } from "@/components/client/actionable-summary";
import { Timeline } from "@/components/client/timeline";
import { AudioRecap } from "@/components/client/audio-recap";
import { QAChat } from "@/components/client/qa-chat";
import { VoiceRecorder } from "@/components/client/voice-recorder";
import { NoteReviewModal } from "@/components/client/note-review";

// The data structure returned by the initial server fetch
interface ClientData {
  id: string;
  name: string;
  phone?: string;
  tags?: string[];
  risk_level: "LOW" | "MED" | "HIGH";
  backboard_thread_id?: string;
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  
  // Data passed from Recorder → Review modal
  const [pendingNote, setPendingNote] = useState("");

  const fetchClientData = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      const json = await res.json();
      setClient(json.client);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Handle successful ingestion from the voice recorder
  const handleIngestSuccess = (data: any) => {
    setRecorderOpen(false); // Close recorder
    setPendingNote(data.note || "No note generated"); // Prep the review modal
    
    // Slight delay for animation smoothness before opening review modal
    setTimeout(() => {
      setReviewOpen(true);
    }, 300);
  };

  // Handle successful save from the review modal
  const handleReviewSuccess = () => {
    setReviewOpen(false);
    // Refresh client data to get new tags/risk + remount timeline/summary
    fetchClientData();
  };

  if (loading) {
    return <div className="p-6 text-sm text-text-tertiary">Loading client record...</div>;
  }

  if (!client) {
    return <div className="p-6 text-sm text-status-high-text">Client not found.</div>;
  }

  return (
    <main className="min-h-dvh flex flex-col pt-6 pb-24 max-w-lg mx-auto bg-bg-base relative">
      {/* Header */}
      <header className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <Link href="/dashboard" className="text-text-tertiary text-sm flex items-center gap-1 hover:text-text-primary">
            <span>&larr;</span> Back to Dashboard
          </Link>
          <StatusBadge level={client.risk_level} />
        </div>
        <h1 className="heading-display text-4xl text-text-primary leading-none mb-3">
          {client.name}
        </h1>
        {client.tags && client.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {client.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="px-5 flex flex-col gap-8 flex-1">
        
        {/* Actionable Summary (Live from Backboard) */}
        <section>
          <ActionableSummary clientId={client.id} />
        </section>

        {/* Audio Recap Generator */}
        <section>
          <AudioRecap clientId={client.id} />
        </section>

        {/* Timeline of History */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest font-mono mb-4">
            Case History
          </h2>
          <Timeline clientId={client.id} />
        </section>

        {/* Q&A Chat */}
        <section className="mt-8">
          <QAChat clientId={client.id} />
        </section>
        
      </div>

      {/* Floating Action Button for Recorder */}
      <button
        onClick={() => setRecorderOpen(true)}
        className="fixed bottom-20 right-5 w-14 h-14 bg-accent-primary text-white rounded-full flex items-center justify-center shadow-float cursor-pointer hover:bg-accent-hover transition-colors z-20 group"
        aria-label="Record Visit"
      >
        <span className="text-2xl group-active:scale-95 transition-transform">🎤</span>
      </button>

      {/* Bottom Sheets / Modals */}
      <VoiceRecorder
        clientId={client.id}
        open={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onIngestSuccess={handleIngestSuccess}
      />

      {reviewOpen && (
        <NoteReviewModal
          clientId={client.id}
          initialNote={pendingNote}
          initialTags={client.tags}
          initialRisk={client.risk_level}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </main>
  );
}
