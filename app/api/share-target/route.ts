import { NextRequest, NextResponse } from "next/server";
import { storeSharedAudio } from "@/lib/share-store";

/**
 * POST /api/share-target
 * 
 * Receives audio files from the Web Share Target API (native Android/iOS share).
 * Stores the file temporarily and redirects to the share processing page.
 * 
 * The manifest.json share_target config sends:
 *   - audio: File (the shared audio file)
 *   - title: string (optional, from the share intent)
 *   - text: string (optional, from the share intent)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const audioFile = formData.get("audio") as File | null;
    const title = (formData.get("title") as string) || undefined;
    const text = (formData.get("text") as string) || undefined;

    if (!audioFile || !(audioFile instanceof File)) {
      // If no audio file was shared, just redirect to dashboard
      return NextResponse.redirect(
        new URL("/dashboard", request.nextUrl.origin),
        303
      );
    }

    // Read the file into a buffer for temp storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store in temporary memory with a UUID key
    const shareId = storeSharedAudio({
      file: buffer,
      filename: audioFile.name || "shared-audio",
      mimeType: audioFile.type || "audio/mpeg",
      title,
      text,
    });

    // Redirect to the share processing page
    return NextResponse.redirect(
      new URL(`/share?id=${shareId}`, request.nextUrl.origin),
      303
    );
  } catch (err) {
    console.error("[share-target] Error processing shared file:", err);
    // On error, redirect to dashboard as fallback
    return NextResponse.redirect(
      new URL("/dashboard", request.nextUrl.origin),
      303
    );
  }
}
