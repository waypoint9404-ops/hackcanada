"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AudioRecapProps {
  clientId: string;
}

export function AudioRecap({ clientId }: AudioRecapProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setFallbackText(null);

    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json();
      
      // Handle the text fallback gracefully if ElevenLabs is blocked
      if (!res.ok || data.warning) {
        console.warn("Audio generation failed or warning returned, using text fallback:", data.warning || data.error);
        setFallbackText(data.recapText || "Could not generate audio summary at this time. ElevenLabs API usage limit reached.");
        return;
      }

      // If successful, create a URL for the audio blob
      if (data.audioBase64) {
        const binaryString = window.atob(data.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const file = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        
        // Auto-play
        const audio = new Audio(url);
        audio.onended = () => setPlaying(false);
        setPlaying(true);
        audio.play().catch((err) => {
          console.error("Auto-play prevented", err);
          setPlaying(false);
        });
      } else {
        throw new Error("No audio data received");
      }

    } catch (err) {
      console.error(err);
      setError("Failed to generate audio recap. Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    // In a real implementation we'd keep track of the Audio object
    // For MVP, if it's already generated we just hit play again on a new instance
    // Or we show toggle state. Here we'll just simplify to replay.
    if (audioUrl && !playing) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlaying(false);
      setPlaying(true);
      audio.play();
    }
  };

  return (
    <div className="w-full my-4">
      {!audioUrl && !fallbackText ? (
        <Button 
          variant="secondary" 
          onClick={handleGenerate} 
          disabled={loading}
          className="w-full flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="flex items-center mx-1">
                <span className="waveform-bar" style={{ animationDelay: "0ms" }} />
                <span className="waveform-bar" style={{ animationDelay: "200ms", height: "14px" }} />
                <span className="waveform-bar" style={{ animationDelay: "400ms" }} />
              </span>
              Generating Audio...
            </>
          ) : (
            <>
              <span className="text-xl">🎧</span> Generate Audio Recap
            </>
          )}
        </Button>
      ) : (
        <div className="bg-bg-elevated p-4 rounded-sm border border-border-subtle flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎧</span>
              <span className="font-mono text-xs font-semibold text-text-primary tracking-wide uppercase">
                {fallbackText ? "Recap (Text Only)" : "Audio Recap Ready"}
              </span>
            </div>
            {audioUrl && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handlePlayPause}
                disabled={playing}
                className="text-accent min-h-[32px] px-3"
              >
                {playing ? 'Playing...' : 'Play Again'}
              </Button>
            )}
          </div>

          {fallbackText ? (
            <div className="text-sm text-text-secondary italic pl-7 border-l-2 border-border-strong mt-1">
              {fallbackText}
              <p className="text-[10px] text-status-med-text mt-2 font-mono not-italic uppercase tracking-widest">⚠️ Voice generation blocked</p>
            </div>
          ) : (
            playing && (
              <div className="flex items-center justify-center h-8 gap-0.5 mt-2 overflow-hidden bg-bg-surface rounded-full w-full max-w-[200px] mx-auto opacity-80 mix-blend-multiply">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span 
                    key={i} 
                    className="waveform-bar" 
                    style={{ 
                      animationDelay: `${i * 75}ms`,
                      height: `${10 + Math.random() * 15}px`,
                      width: '4px'
                    }} 
                  />
                ))}
              </div>
            )
          )}
          
          {error && <p className="text-xs text-status-high-text mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
