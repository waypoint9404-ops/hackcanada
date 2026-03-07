"use client";

import { useState, useRef } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface VoiceRecorderProps {
  clientId?: string;
  open: boolean;
  onClose: () => void;
  onIngestSuccess: (data: any) => void;
}

export function VoiceRecorder({ clientId, open, onClose, onIngestSuccess }: VoiceRecorderProps) {
  const [mode, setMode] = useState<"audio" | "text">("audio");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio state
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Text state
  const [transcriptText, setTranscriptText] = useState("");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        handleAudioUpload(audioBlob);
      };

      mediaRecorder.current.start();
      setRecording(true);
      setError(null);
      setDuration(0);
      
      timerInterval.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Mic access denied", err);
      setError("Microphone access denied. Please allow microphone permissions or use text upload.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      setRecording(false);
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
  };

  const handleAudioUpload = async (blob: Blob) => {
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      if (clientId) formData.append("clientId", clientId);
      formData.append("localTimestamp", new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }));
      formData.append("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingestion failed");
      
      onIngestSuccess(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error processing audio");
      setProcessing(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!transcriptText.trim()) return;
    
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...(clientId ? { clientId } : {}), 
          transcript: transcriptText,
          localTimestamp: new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingestion failed");

      onIngestSuccess(data);
    } catch (err) {
      console.error(err);
      setError("Error processing text transcript");
      setProcessing(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const softClose = () => {
    if (recording) stopRecording();
    if (!processing) {
      setMode("audio");
      setTranscriptText("");
      setError(null);
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={softClose} title={mode === "audio" ? (clientId ? "Record Case Note" : "Record New Client/Visit") : "Upload Transcript"}>
      <div className="flex flex-col gap-6">
        
        {/* Input Mode Toggle */}
        {!recording && !processing && (
          <div className="flex p-1 bg-bg-elevated rounded-sm border border-border-subtle w-full">
            <button 
              className={`flex-1 py-1.5 text-xs font-mono tracking-wide uppercase rounded-[2px] ${mode === "audio" ? "bg-bg-surface shadow-[var(--shadow-sm)] text-text-primary" : "text-text-secondary"}`}
              onClick={() => { setMode("audio"); setError(null); }}
            >
               Voice
            </button>
            <button 
              className={`flex-1 py-1.5 text-xs font-mono tracking-wide uppercase rounded-[2px] ${mode === "text" ? "bg-bg-surface shadow-[var(--shadow-sm)] text-text-primary" : "text-text-secondary"}`}
              onClick={() => { setMode("text"); setError(null); }}
            >
               Text Entry
            </button>
          </div>
        )}

        {/* --- AUDIO MODE --- */}
        {mode === "audio" && (
          <div className="flex flex-col items-center justify-center py-6 gap-6">
            <div className={`text-4xl font-mono tabular-nums ${recording ? "text-accent" : "text-text-primary"}`}>
              {formatTime(duration)}
            </div>

            {processing ? (
              <div className="flex flex-col items-center text-center gap-3 w-full">
                <p className="text-sm text-text-primary font-medium animate-pulse">Processing via ElevenLabs & Backboard...</p>
                <div className="h-1.5 w-full max-w-[200px] overflow-hidden bg-bg-elevated rounded-full">
                  <div className="h-full bg-accent-primary animate-[shimmer_1s_infinite] w-[50%]" />
                </div>
              </div>
            ) : (
              <Button 
                variant={recording ? "danger" : "primary"}
                onClick={recording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${recording ? "animate-pulse" : ""}`}
                style={{ padding: 0 }}
              >
                {recording ? (
                  <div className="w-6 h-6 bg-white rounded-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <span className="w-4 h-4 rounded-full bg-accent-primary block" />
                  </div>
                )}
              </Button>
            )}

            {!recording && !processing && (
              <p className="text-sm text-text-secondary text-center">
                Tap to start recording. Speak naturally.
              </p>
            )}
            {recording && (
              <p className="text-sm text-status-high-text font-medium text-center">
                Recording... Tap square to finalize ingestion.
              </p>
            )}
          </div>
        )}

        {/* --- TEXT MODE --- */}
        {mode === "text" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              If ElevenLabs API is blocked or offline, you can paste the text transcript of the meeting here to run it through Backboard's note extraction workflow.
            </p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Client states they have been..."
              rows={8}
              disabled={processing}
              className="w-full bg-bg-surface border border-border-subtle rounded-sm p-3 text-sm focus:outline-none focus:border-border-strong resize-none whitespace-pre-wrap"
            />
            <Button 
              variant="primary" 
              className="w-full" 
              onClick={handleTextSubmit}
              disabled={!transcriptText.trim() || processing}
            >
              {processing ? "Processing AI Note..." : "Process Transcript"}
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-status-high-bg border border-status-high-bg text-status-high-text rounded-sm text-sm">
            {error}
          </div>
        )}

      </div>
    </Sheet>
  );
}
