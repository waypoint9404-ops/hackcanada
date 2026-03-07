/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach per IP address.
 *
 * Usage:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   const limiter = rateLimit({ interval: 60_000, limit: 10 });
 *
 *   // In route handler:
 *   const { success } = limiter.check(request);
 *   if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

import { NextRequest } from "next/server";

interface RateLimitConfig {
  /** Time window in milliseconds */
  interval: number;
  /** Max requests per interval */
  limit: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries periodically (every 5 mins)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 300_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 300_000);
}

export function rateLimit(config: RateLimitConfig) {
  return {
    check(request: NextRequest): { success: boolean; remaining: number } {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";

      const key = `${ip}`;
      const now = Date.now();

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter(
        (t) => now - t < config.interval
      );

      if (entry.timestamps.length >= config.limit) {
        return {
          success: false,
          remaining: 0,
        };
      }

      entry.timestamps.push(now);
      return {
        success: true,
        remaining: config.limit - entry.timestamps.length,
      };
    },
  };
}

/**
 * Utility to add a delay between sequential API calls.
 * Use this to prevent hammering external APIs (e.g., ElevenLabs).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
