"use client";

import { useState, useRef } from "react";
import { Modal } from "@/components/ui/modal";

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
    <Modal open={open} onClose={softClose} centered={true} title={mode === "audio" ? (clientId ? "Record Case Note" : "New Visit Record") : "Text Transcript"}>
      <div className="flex flex-col gap-6">
        
        {/* Input Mode Toggle */}
        {!recording && !processing && (
          <div className="flex p-1 bg-bg-elevated rounded-md border border-border-subtle w-full">
            <button 
              className={`flex-1 py-2.5 text-xs font-mono tracking-wider uppercase rounded-[4px] min-h-[40px] transition-all duration-200 ${mode === "audio" ? "bg-bg-surface shadow-[var(--shadow-sm)] text-text-primary font-semibold" : "text-text-tertiary hover:text-text-secondary"}`}
              onClick={() => { setMode("audio"); setError(null); }}
            >
              Voice
            </button>
            <button 
              className={`flex-1 py-2.5 text-xs font-mono tracking-wider uppercase rounded-[4px] min-h-[40px] transition-all duration-200 ${mode === "text" ? "bg-bg-surface shadow-[var(--shadow-sm)] text-text-primary font-semibold" : "text-text-tertiary hover:text-text-secondary"}`}
              onClick={() => { setMode("text"); setError(null); }}
            >
              Text
            </button>
          </div>
        )}

        {/* --- AUDIO MODE --- */}
        {mode === "audio" && (
          <div className="flex flex-col items-center justify-center gap-6 py-2">
            
            {/* Timer */}
            <div className={`text-5xl font-mono tabular-nums tracking-tight ${recording ? "text-status-high-text" : "text-text-primary"}`}>
              {formatTime(duration)}
            </div>

            {processing ? (
              <div className="flex flex-col items-center text-center gap-4 w-full py-4">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.15}s`, background: 'var(--accent-ai)' }} />
                  ))}
                </div>
                <p className="text-sm text-accent-ai font-medium">Analyzing & structuring notes...</p>
                <p className="text-xs text-text-tertiary">Backboard is processing your recording</p>
              </div>
            ) : (
              <>
                {/* Record button with pulse ring */}
                <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
                  {recording && <div className="rec-pulse-ring" />}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                      recording 
                        ? "bg-status-high-bg border-2 border-status-high-text rec-btn-pulse" 
                        : "bg-accent text-white hover:bg-accent-hover shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-float)] active:scale-95"
                    }`}
                    style={{ minHeight: 80, minWidth: 80 }}
                  >
                    {recording ? (
                      <div className="w-6 h-6 bg-status-high-text rounded-sm" />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Status text */}
                {!recording && (
                  <p className="text-sm text-text-secondary text-center leading-relaxed">
                    Tap to begin recording your visit notes
                  </p>
                )}
                {recording && (
                  <p className="text-sm text-status-high-text font-medium text-center">
                    Recording &mdash; tap to stop & process
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* --- TEXT MODE --- */}
        {mode === "text" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              Paste or type a transcript to extract structured case notes.
            </p>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Client states they have been..."
              rows={6}
              disabled={processing}
              className="w-full bg-bg-elevated border border-border-subtle rounded-md p-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong focus:bg-bg-surface resize-none whitespace-pre-wrap transition-colors duration-200"
            />
            <button 
              onClick={handleTextSubmit}
              disabled={!transcriptText.trim() || processing}
              className={`w-full py-3 text-sm font-medium rounded-md min-h-[48px] transition-all duration-200 cursor-pointer ${
                !transcriptText.trim() || processing
                  ? "bg-bg-elevated text-text-tertiary cursor-not-allowed"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]"
              }`}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : "Process Transcript"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3.5 bg-status-high-bg border border-status-high-text/20 text-status-high-text rounded-md text-sm leading-relaxed">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
