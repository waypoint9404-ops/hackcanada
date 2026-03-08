"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square } from "lucide-react";

interface AudioRecapProps {
  clientId: string;
}

export function AudioRecap({ clientId }: AudioRecapProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const updateProgress = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    if (playing) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playing]);

  const formatTime = (time: number): string => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

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
        
        // Let the useEffect hook handle auto-play once the audio element is rendered
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

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error("Play prevented", err));
    }
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  };

  return (
    <div className="w-full">
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
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={togglePlayPause}
                  className="h-8 w-8 text-accent hover:bg-accent/10"
                >
                  {playing ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
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

          {fallbackText ? (
            <div className="text-sm text-text-secondary italic pl-7 border-l-2 border-border-strong mt-1">
              {fallbackText}
              <p className="text-[10px] text-status-med-text mt-2 font-mono not-italic uppercase tracking-widest">⚠️ Voice generation blocked</p>
            </div>
          ) : (
            <>
              {/* Native audio element handles precise playback timing and events */}
              {audioUrl && (
                <audio 
                  ref={audioRef}
                  src={audioUrl}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={() => {
                    if (audioRef.current) {
                      setCurrentTime(audioRef.current.currentTime);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (audioRef.current) {
                      setDuration(audioRef.current.duration);
                    }
                  }}
                  onEnded={() => {
                    setPlaying(false);
                    if (audioRef.current) audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }}
                  className="hidden"
                  autoPlay
                />
              )}
              
              <div className={`flex items-center justify-center h-8 gap-0.5 mt-2 overflow-hidden bg-bg-surface rounded-full w-full max-w-[200px] mx-auto opacity-80 mix-blend-multiply transition-opacity duration-300 ${playing ? 'opacity-100' : 'opacity-40'}`}>
                {Array.from({ length: 24 }).map((_, i) => {
                  // Fixed heights arrays so it doesn't Math.random() on every playback frame!
                  const heights = [12, 18, 15, 24, 10, 22, 16, 25, 20, 14, 21, 19, 12, 25, 18, 14, 22, 16, 24, 13, 20, 15, 19, 11];
                  return (
                    <span 
                      key={i} 
                      className="waveform-bar" 
                      style={{ 
                        animationDelay: `${i * 120}ms`,
                        animationDuration: '1.5s',
                        height: `${heights[i]}px`,
                        width: '4px',
                        animationPlayState: playing ? 'running' : 'paused'
                      }} 
                    />
                  );
                })}
              </div>

              {/* Audio scrubber below waveform */}
              {audioUrl && (
                <div className="flex flex-col gap-2 mt-3">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.01"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-border-subtle rounded-full appearance-none cursor-pointer accent-accent"
                    style={{
                      background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${duration ? (currentTime / duration) * 100 : 0}%, var(--color-border-subtle) ${duration ? (currentTime / duration) * 100 : 0}%, var(--color-border-subtle) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-text-secondary px-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}
            </>
          )}
          
          {error && <p className="text-xs text-status-high-text mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
