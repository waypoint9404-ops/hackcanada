"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Volume2 } from "lucide-react";

interface MorningBriefingProps {
  timezone?: string;
}

export function MorningBriefing({ timezone = "America/Toronto" }: MorningBriefingProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setFallbackText(null);
    setBriefingText(null);

    try {
      const res = await fetch("/api/itinerary/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate briefing");
        return;
      }

      setBriefingText(data.briefingText);

      if (data.warning || !data.audioBase64) {
        setFallbackText(
          data.briefingText || "Could not generate audio briefing."
        );
        return;
      }

      // Decode base64 audio
      const binaryString = window.atob(data.audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate morning briefing. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Play prevented:", err));
    }
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
  };

  // Initial state: show big CTA button
  if (!audioUrl && !fallbackText && !error) {
    return (
      <Button
        variant="primary"
        size="lg"
        onClick={handleGenerate}
        disabled={loading}
        className="w-full gap-2"
      >
        {loading ? (
          <>
            <span className="flex items-center mx-1">
              <span className="waveform-bar" style={{ animationDelay: "0ms" }} />
              <span className="waveform-bar" style={{ animationDelay: "200ms", height: "14px" }} />
              <span className="waveform-bar" style={{ animationDelay: "400ms" }} />
            </span>
            Generating Briefing...
          </>
        ) : (
          <>
            <Volume2 size={20} /> Play Morning Briefing
          </>
        )}
      </Button>
    );
  }

  // Audio player / text fallback
  return (
    <div className="bg-accent/5 border border-accent/20 rounded-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 size={18} className="text-accent" />
          <span className="font-mono text-xs font-semibold text-text-primary tracking-wide uppercase">
            {fallbackText ? "Morning Briefing (Text)" : "Morning Briefing"}
          </span>
        </div>

        {audioUrl && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayPause}
              className="h-8 w-8 text-accent hover:bg-accent/10"
            >
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={stopAudio}
              disabled={!playing && audioRef.current?.currentTime === 0}
              className="h-8 w-8 text-status-high-text hover:bg-status-high-bg"
            >
              <Square size={16} fill="currentColor" />
            </Button>
          </div>
        )}
      </div>

      {/* Text fallback */}
      {fallbackText && (
        <div className="text-sm text-text-secondary italic pl-4 border-l-2 border-accent/30">
          {fallbackText}
          <p className="text-[10px] text-status-med-text mt-2 font-mono not-italic uppercase tracking-widest">
            Audio generation unavailable
          </p>
        </div>
      )}

      {/* Waveform visualization */}
      {audioUrl && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            className="hidden"
            autoPlay
          />

          <div
            className={`flex items-center justify-center h-8 gap-0.5 overflow-hidden bg-bg-surface rounded-full w-full max-w-[240px] mx-auto transition-opacity duration-300 ${
              playing ? "opacity-100" : "opacity-40"
            }`}
          >
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="waveform-bar"
                style={{
                  animationDelay: `${i * 65}ms`,
                  height: `${10 + Math.random() * 15}px`,
                  width: "3px",
                  animationPlayState: playing ? "running" : "paused",
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Expandable transcript */}
      {briefingText && !fallbackText && (
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="text-[11px] text-text-tertiary hover:text-text-secondary font-mono uppercase tracking-widest text-left transition-colors"
        >
          {showTranscript ? "▾ Hide transcript" : "▸ Show transcript"}
        </button>
      )}
      {showTranscript && briefingText && (
        <p className="text-sm text-text-secondary leading-relaxed pl-4 border-l-2 border-border-subtle">
          {briefingText}
        </p>
      )}

      {/* Error */}
      {error && <p className="text-xs text-status-high-text">{error}</p>}

      {/* Regenerate button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className="text-text-tertiary text-xs mt-1"
      >
        {loading ? "Regenerating..." : "Regenerate briefing"}
      </Button>
    </div>
  );
}
