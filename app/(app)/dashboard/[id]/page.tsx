/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, TagBadge } from "@/components/ui/badge";
import { ActionableSummary } from "@/components/client/actionable-summary";
import { Timeline } from "@/components/client/timeline";
import { AudioRecap } from "@/components/client/audio-recap";
import { QAChat } from "@/components/client/qa-chat";
import { VoiceRecorder } from "@/components/client/voice-recorder";
import { NoteReviewModal } from "@/components/client/note-review";
import { DocumentUpload } from "@/components/client/document-upload";
import { Button } from "@/components/ui/button";
import { UpcomingEvents } from "@/components/schedule/upcoming-events";

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
  const router = useRouter();
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Data passed from Recorder → Review modal
  const [pendingNote, setPendingNote] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<0 | 1>(0);
  const [historyFilter, setHistoryFilter] = useState<"all" | "notes" | "documents">("all");

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPosition = target.scrollLeft;
    const width = target.clientWidth;
    const index = Math.round(scrollPosition / width);
    setActiveSection(index as 0 | 1);
  };

  const scrollToSection = (index: number) => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollTo({ left: width * index, behavior: 'smooth' });
    }
  };

  // Version counter to force refresh of summary + timeline after changes
  const [dataVersion, setDataVersion] = useState(0);

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
    
    // Update risk level immediately if the AI detected a change
    if (data.riskLevel && client) {
      setClient({ ...client, risk_level: data.riskLevel });
    }
    
    // Slight delay for animation smoothness before opening review modal
    setTimeout(() => {
      setReviewOpen(true);
    }, 300);
  };

  // Handle successful save from the review modal
  const handleReviewSuccess = () => {
    setReviewOpen(false);
    // Increment version to refresh timeline + summary
    setDataVersion((v) => v + 1);
    // Also refresh client data for tags/risk
    fetchClientData();
  };

  // Handle note edit from the Timeline component
  const handleNoteEdited = () => {
    setDataVersion((v) => v + 1);
  };

  // Handle document upload completion
  const handleDocumentProcessed = () => {
    setDataVersion((v) => v + 1);
    fetchClientData();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-text-tertiary">Loading client record...</div>;
  }

  if (!client) {
    return <div className="p-6 text-sm text-status-high-text">Client not found.</div>;
  }

  return (
    <main className="min-h-dvh flex flex-col pt-6 pb-24 md:max-w-4xl max-w-lg mx-auto bg-bg-base relative">
      {/* Header */}
      <header className="px-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <Link href="/dashboard" className="text-text-tertiary text-sm flex items-center gap-1 hover:text-text-primary">
            <span>&larr;</span> Back to Dashboard
          </Link>
          <StatusBadge level={client.risk_level} />
        </div>
        <div className="flex items-start justify-between mb-3">
          <h1 className="heading-display text-4xl text-text-primary leading-none">
            {client.name}
          </h1>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-text-tertiary hover:text-status-high-text transition-colors p-1.5 -mr-1.5 cursor-pointer"
            aria-label="Delete client"
            title="Delete client"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
        {client.tags && client.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {client.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
      </header>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mx-5 mb-6 p-4 bg-status-high-bg border border-status-high-text/20 rounded-sm">
          <p className="text-sm text-status-high-text font-medium mb-3">
            Permanently delete {client.name}?
          </p>
          <p className="text-xs text-text-secondary mb-4">
            This removes the client record from your caseload. The AI conversation thread on Backboard is retained.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="flex-1 px-3 py-2 text-xs font-medium bg-bg-surface border border-border-subtle rounded-sm hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-3 py-2 text-xs font-medium bg-status-high-text text-white rounded-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Client"}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-5 flex flex-col gap-8 flex-1">
        
        {/* Summary & QA Carousel */}
        <section className="flex flex-col relative w-full overflow-hidden">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex items-stretch overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden pb-1"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            <div className="min-w-full w-full snap-center shrink-0 pr-4 flex flex-col">
              <ActionableSummary clientId={client.id} refreshKey={dataVersion} />
            </div>
            <div className="min-w-full w-full snap-start shrink-0 flex flex-col">
              <QAChat clientId={client.id} />
            </div>
          </div>
          
          {/* Carousel Indicators */}
          <div className="flex justify-center items-center gap-1 mt-1 mb-1">
            <button 
              onClick={() => scrollToSection(0)}
              className="p-2 cursor-pointer group"
              aria-label="View Actionable Summary"
            >
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSection === 0 ? "w-4 bg-text-secondary" : "w-1.5 bg-border-subtle group-hover:bg-text-secondary/50"}`} />
            </button>
            <button 
              onClick={() => scrollToSection(1)}
              className="p-2 cursor-pointer group"
              aria-label="View Case Q&A"
            >
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSection === 1 ? "w-4 bg-text-secondary" : "w-1.5 bg-border-subtle group-hover:bg-text-secondary/50"}`} />
            </button>
          </div>
        </section>

        {/* Upcoming Schedule Events */}
        <UpcomingEvents clientId={client.id} refreshKey={dataVersion} />

        {/* Audio Recap & Record Visit */}
        <section className="flex flex-col gap-2">
          <AudioRecap clientId={client.id} />
          
          <Button
            variant="secondary"
            onClick={() => setRecorderOpen(true)}
            className="w-full flex items-center justify-center gap-2"
          >
            <span className="text-xl">🎤</span>
            Record Visit
          </Button>
        </section>

        {/* Case Documents */}
        <section>
          <DocumentUpload
            clientId={client.id}
            onDocumentProcessed={handleDocumentProcessed}
          />
        </section>

        {/* Timeline of History */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest font-mono">
              Case History
            </h2>
            <div className="flex bg-bg-surface border border-border-subtle rounded-sm p-0.5">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors ${historyFilter === 'all' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryFilter('notes')}
                className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors ${historyFilter === 'notes' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                Notes
              </button>
              <button
                onClick={() => setHistoryFilter('documents')}
                className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-sm transition-colors ${historyFilter === 'documents' ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                Docs
              </button>
            </div>
          </div>
          <Timeline
            clientId={client.id}
            refreshKey={dataVersion}
            onNoteEdited={handleNoteEdited}
            filter={historyFilter}
          />
        </section>
        
      </div>

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
