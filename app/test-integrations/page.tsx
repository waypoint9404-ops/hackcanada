"use client";

import { useState, useEffect, useRef } from "react";

interface Client {
  id: string;
  name: string;
  tags: string[];
  risk_level: string;
  backboard_thread_id: string | null;
  summary: string | null;
}

interface TestResult {
  label: string;
  status: "idle" | "loading" | "success" | "error";
  data: unknown;
}

export default function TestIntegrationsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const [results, setResults] = useState<TestResult[]>([
    { label: "Backboard Connection", status: "idle", data: null },
    { label: "Ingest Pipeline", status: "idle", data: null },
    { label: "Q&A (RAG)", status: "idle", data: null },
    { label: "ElevenLabs TTS", status: "idle", data: null },
    { label: "Full Recap Pipeline", status: "idle", data: null },
  ]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recapAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch clients from Supabase on mount
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        if (data.clients && data.clients.length > 0) {
          setClients(data.clients);
          setSelectedClient(data.clients[0]); // Default to first client
        } else {
          setClientsError(data.error || "No clients found. Run the SQL migration first.");
        }
      } catch (err) {
        setClientsError(String(err));
      } finally {
        setClientsLoading(false);
      }
    }
    fetchClients();
  }, []);

  const updateResult = (index: number, update: Partial<TestResult>) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...update } : r))
    );
  };

  // ─── Test 1: Backboard Connection ─────────────────────────────────────

  async function testBackboard() {
    updateResult(0, { status: "loading", data: null });
    try {
      const res = await fetch("/api/backboard/test");
      const data = await res.json();
      updateResult(0, {
        status: data.success ? "success" : "error",
        data,
      });
    } catch (err) {
      updateResult(0, { status: "error", data: { error: String(err) } });
    }
  }

  // ─── Test 2: Ingest Pipeline ──────────────────────────────────────────

  async function testIngest() {
    if (!selectedClient) return;
    updateResult(1, { status: "loading", data: null });
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          transcript:
            `Met ${selectedClient.name} at the 4th Street shelter today. They missed their rent payment and are at risk of eviction. The landlord filed a notice. ${selectedClient.name} stopped taking their bipolar medication two weeks ago. They appeared agitated but cooperative. Referred to the emergency housing fund.`,
        }),
      });
      const data = await res.json();
      updateResult(1, {
        status: data.success ? "success" : "error",
        data,
      });
      // Refresh clients list to see updated thread_id
      if (data.success) {
        const refreshRes = await fetch("/api/clients");
        const refreshData = await refreshRes.json();
        if (refreshData.clients) {
          setClients(refreshData.clients);
          const updated = refreshData.clients.find((c: Client) => c.id === selectedClient.id);
          if (updated) setSelectedClient(updated);
        }
      }
    } catch (err) {
      updateResult(1, { status: "error", data: { error: String(err) } });
    }
  }

  // ─── Test 3: Smart Q&A ────────────────────────────────────────────────

  async function testQnA() {
    if (!selectedClient) return;
    updateResult(2, { status: "loading", data: null });
    try {
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          question: `What is ${selectedClient.name}'s current risk level and what interventions have been tried?`,
        }),
      });
      const data = await res.json();
      updateResult(2, {
        status: data.success ? "success" : "error",
        data,
      });
    } catch (err) {
      updateResult(2, { status: "error", data: { error: String(err) } });
    }
  }

  // ─── Test 4: ElevenLabs TTS ───────────────────────────────────────────

  async function testElevenLabs() {
    updateResult(3, { status: "loading", data: null });
    try {
      const res = await fetch("/api/elevenlabs/test");
      const data = await res.json();

      // If we got audio, create a playable URL
      if (data.success && data.audioBase64) {
        const audioBytes = Uint8Array.from(atob(data.audioBase64), (c) =>
          c.charCodeAt(0)
        );
        const blob = new Blob([audioBytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
        }
      }

      updateResult(3, {
        status: data.success ? "success" : "error",
        data: data.success
          ? {
              success: true,
              audioSizeBytes: data.audioSizeBytes,
              testText: data.testText,
              note: data.audioBase64
                ? "Audio generated — use player below"
                : undefined,
            }
          : data,
      });
    } catch (err) {
      updateResult(3, { status: "error", data: { error: String(err) } });
    }
  }

  // ─── Test 5: Full Recap Pipeline ──────────────────────────────────────

  async function testRecap() {
    if (!selectedClient) return;
    updateResult(4, { status: "loading", data: null });
    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClient.id }),
      });

      if (!res.ok) {
        const errData = await res.json();
        updateResult(4, { status: "error", data: errData });
        return;
      }

      // Response is audio/mpeg
      const recapText = decodeURIComponent(
        res.headers.get("X-Recap-Text") ?? ""
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (recapAudioRef.current) {
        recapAudioRef.current.src = url;
      }

      updateResult(4, {
        status: "success",
        data: {
          success: true,
          client: selectedClient.name,
          audioSizeBytes: blob.size,
          recapText: recapText || "[see X-Recap-Text header]",
          note: "Use player below to listen",
        },
      });
    } catch (err) {
      updateResult(4, { status: "error", data: { error: String(err) } });
    }
  }

  const statusColors: Record<string, string> = {
    idle: "#6b7280",
    loading: "#f59e0b",
    success: "#10b981",
    error: "#ef4444",
  };

  const statusLabels: Record<string, string> = {
    idle: "Ready",
    loading: "Running…",
    success: "✓ Passed",
    error: "✗ Failed",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <header style={{ marginBottom: "2rem" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Waypoint — Integration Tests
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Skeleton workflow smoke tests for Backboard, Supabase, and Auth0.
          </p>
        </header>

        {/* Client Selector */}
        <div
          style={{
            border: "1px solid #27272a",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "#111111",
            marginBottom: "1rem",
          }}
        >
          <label
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "#71717a",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: "0.5rem",
            }}
          >
            Test Client (from Supabase)
          </label>
          {clientsLoading ? (
            <p style={{ color: "#f59e0b", fontSize: "0.8125rem" }}>Loading clients…</p>
          ) : clientsError ? (
            <p style={{ color: "#ef4444", fontSize: "0.8125rem" }}>{clientsError}</p>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  style={{
                    background:
                      selectedClient?.id === client.id ? "#fafafa" : "#1a1a1a",
                    color:
                      selectedClient?.id === client.id ? "#0a0a0a" : "#a1a1aa",
                    border: `1px solid ${
                      selectedClient?.id === client.id ? "#fafafa" : "#27272a"
                    }`,
                    borderRadius: "0.5rem",
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {client.name}{" "}
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      opacity: 0.6,
                    }}
                  >
                    ({client.risk_level})
                  </span>
                </button>
              ))}
            </div>
          )}
          {selectedClient && (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.6875rem",
                color: "#52525b",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              ID: {selectedClient.id}
              {selectedClient.backboard_thread_id && (
                <> | Thread: {selectedClient.backboard_thread_id}</>
              )}
            </p>
          )}
        </div>

        {/* Test Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {results.map((result, i) => (
            <div
              key={result.label}
              style={{
                border: "1px solid #27272a",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                background: "#111111",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <h2 style={{ fontSize: "1rem", fontWeight: 500 }}>
                  {result.label}
                </h2>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: statusColors[result.status],
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {statusLabels[result.status]}
                </span>
              </div>

              <button
                onClick={
                  i === 0
                    ? testBackboard
                    : i === 1
                    ? testIngest
                    : i === 2
                    ? testQnA
                    : i === 3
                    ? testElevenLabs
                    : testRecap
                }
                disabled={
                  result.status === "loading" ||
                  (i > 0 && i !== 3 && !selectedClient)
                }
                style={{
                  background:
                    result.status === "loading" ||
                    (i > 0 && i !== 3 && !selectedClient)
                      ? "#27272a"
                      : "#fafafa",
                  color:
                    result.status === "loading" ||
                    (i > 0 && i !== 3 && !selectedClient)
                      ? "#71717a"
                      : "#0a0a0a",
                  border: "none",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor:
                    result.status === "loading" ||
                    (i > 0 && i !== 3 && !selectedClient)
                      ? "not-allowed"
                      : "pointer",
                  transition: "opacity 0.15s",
                  marginBottom: result.data ? "0.75rem" : 0,
                }}
              >
                {[
                  "Test Backboard Connection",
                  "Test Ingest Pipeline",
                  "Test Q&A",
                  "Test ElevenLabs TTS",
                  "Test Full Recap",
                ][i]}
              </button>

              {i === 3 && result.status === "success" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <audio
                    ref={audioRef}
                    controls
                    style={{ width: "100%", height: "36px" }}
                  />
                </div>
              )}
              {i === 4 && result.status === "success" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <audio
                    ref={recapAudioRef}
                    controls
                    style={{ width: "100%", height: "36px" }}
                  />
                </div>
              )}

              {result.data != null && (
                <pre
                  style={{
                    background: "#0a0a0a",
                    border: "1px solid #27272a",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "#a1a1aa",
                    overflow: "auto",
                    maxHeight: "300px",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>

        <footer
          style={{
            marginTop: "2rem",
            padding: "1rem",
            borderTop: "1px solid #27272a",
            fontSize: "0.75rem",
            color: "#52525b",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
        >
          <p>Tests 1 & 4 work standalone. Tests 2, 3, & 5 need Supabase clients + Backboard threads.</p>
        </footer>
      </div>
    </div>
  );
}
