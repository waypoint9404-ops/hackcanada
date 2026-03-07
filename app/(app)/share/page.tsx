"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, FileAudio, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ClientOption {
  id: string;
  name: string;
  risk_level: string;
}

type ProcessingState = "idle" | "selecting" | "processing" | "success" | "error";

export default function SharePage() {
  const searchParams = useSearchParams();
  const shareId = searchParams.get("id");

  const [state, setState] = useState<ProcessingState>("idle");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    clientId: string;
    clientName: string;
    note: string;
    transcript: string;
    isNewClient: boolean;
  } | null>(null);
  const [error, setError] = useState<string>("");
  const [loadingClients, setLoadingClients] = useState(true);

  // Fetch client list on mount
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        if (res.ok) {
          const data = await res.json();
          setClients(data.clients || []);
        }
      } catch {
        // Non-critical — user can still auto-detect
      } finally {
        setLoadingClients(false);
      }
    }
    fetchClients();
  }, []);

  const processAudio = useCallback(
    async (clientId?: string) => {
      if (!shareId) return;
      setState("processing");
      setError("");

      try {
        const res = await fetch("/api/share-target/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareId,
            clientId: clientId || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Processing failed");
        }

        setResult(data);
        setState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    },
    [shareId]
  );

  // No share ID — invalid state
  if (!shareId) {
    return (
      <main className="px-5 py-8 max-w-lg mx-auto">
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
          <h1 className="heading-display text-2xl mb-2 text-text-primary">
            No Shared Audio
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Share an audio file from another app to add a case note.
          </p>
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-5 py-8 max-w-lg mx-auto">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="heading-display text-3xl text-text-primary">
          Shared Audio
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Process a shared voice note into a case note.
        </p>
      </header>

      {/* Idle / Selection State */}
      {(state === "idle" || state === "selecting") && (
        <div className="flex flex-col gap-4">
          {/* Audio Info Card */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-ai-light flex items-center justify-center shrink-0">
                <FileAudio className="w-5 h-5 text-accent-ai" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Audio file ready to process
                </p>
                <p className="text-xs text-text-tertiary">
                  Will be transcribed and added as a case note
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Action: Auto-Detect */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => processAudio()}
          >
            <Users className="w-4 h-4 mr-2" />
            Auto-Detect Client & Process
          </Button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-xs text-text-tertiary uppercase tracking-wider">
              or choose a client
            </span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          {/* Client List */}
          {loadingClients ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-4">
              No existing clients. Use auto-detect above to create one.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setState("selecting");
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedClientId === client.id
                      ? "border-accent bg-accent/5"
                      : "border-border-subtle hover:border-border-strong bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">
                      {client.name}
                    </span>
                    <RiskDot level={client.risk_level} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Process with selected client */}
          {selectedClientId && (
            <Button
              variant="primary"
              size="lg"
              className="w-full mt-2"
              onClick={() => processAudio(selectedClientId)}
            >
              Process for{" "}
              {clients.find((c) => c.id === selectedClientId)?.name}
            </Button>
          )}
        </div>
      )}

      {/* Processing State */}
      {state === "processing" && (
        <Card className="p-8">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
            <h2 className="text-lg font-medium text-text-primary mb-2">
              Processing Audio
            </h2>
            <p className="text-sm text-text-secondary">
              Transcribing and creating case note...
            </p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-text-tertiary w-full">
              <Step label="Transcribing audio via ElevenLabs" />
              <Step label="Identifying or creating client" />
              <Step label="Processing note via Backboard AI" />
            </div>
          </div>
        </Card>
      )}

      {/* Success State */}
      {state === "success" && result && (
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-status-low-text shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-medium text-text-primary">
                  Note Added Successfully
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  {result.isNewClient ? "New client created: " : "Added to: "}
                  <strong>{result.clientName}</strong>
                </p>
              </div>
            </div>

            {/* Transcript */}
            <div className="mb-4">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Transcript
              </h3>
              <p className="text-sm text-text-secondary bg-bg-elevated rounded-lg p-3 leading-relaxed">
                {result.transcript}
              </p>
            </div>

            {/* Structured Note */}
            <div>
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Structured Note
              </h3>
              <div className="text-sm text-text-primary bg-bg-elevated rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                {result.note}
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Link href={`/dashboard/${result.clientId}`} className="flex-1">
              <Button variant="primary" size="lg" className="w-full">
                View Client
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button variant="secondary" size="lg" className="w-full">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === "error" && (
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-status-high-text shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-1">
                  Processing Failed
                </h2>
                <p className="text-sm text-text-secondary">{error}</p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => {
                setState("idle");
                setError("");
              }}
            >
              Try Again
            </Button>
            <Link href="/dashboard" className="flex-1">
              <Button variant="secondary" size="lg" className="w-full">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

/** Small risk level indicator dot */
function RiskDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-status-high-text",
    MED: "bg-status-med-text",
    LOW: "bg-status-low-text",
  };
  return (
    <span
      className={`w-2 h-2 rounded-full ${colors[level] || "bg-text-tertiary"}`}
    />
  );
}

/** Processing step indicator */
function Step({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="w-3 h-3 animate-spin text-accent" />
      <span>{label}</span>
    </div>
  );
}
