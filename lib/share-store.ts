/**
 * Temporary in-memory store for shared audio files.
 * 
 * When a user shares an audio file to the PWA via the OS share sheet,
 * the file is stored here with a UUID key, then the user is redirected
 * to the share processing page. Files auto-expire after 5 minutes.
 */

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface SharedAudioEntry {
  file: Buffer;
  filename: string;
  mimeType: string;
  title?: string;
  text?: string;
  createdAt: number;
}

const store = new Map<string, SharedAudioEntry>();

/** Store a shared audio file and return a unique key. */
export function storeSharedAudio(entry: Omit<SharedAudioEntry, "createdAt">): string {
  cleanup();
  const id = crypto.randomUUID();
  store.set(id, { ...entry, createdAt: Date.now() });
  return id;
}

/** Retrieve and remove a shared audio file by key. Returns null if expired or missing. */
export function retrieveSharedAudio(id: string): SharedAudioEntry | null {
  cleanup();
  const entry = store.get(id);
  if (!entry) return null;
  store.delete(id);
  return entry;
}

/** Peek at a shared audio entry without removing it. */
export function peekSharedAudio(id: string): SharedAudioEntry | null {
  cleanup();
  return store.get(id) ?? null;
}

/** Remove expired entries. */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > EXPIRY_MS) {
      store.delete(key);
    }
  }
}
