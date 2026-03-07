/**
 * Supabase Storage helpers for case document uploads.
 * All operations use the admin client (bypasses RLS).
 * Files are stored in the "case-documents" bucket.
 *
 * SETUP: Create a private bucket named "case-documents" in
 * Supabase Dashboard → Storage → New Bucket.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "case-documents";
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Upload a document to Supabase Storage.
 * Path format: {clientId}/{uuid}-{sanitizedFilename}
 * Returns the storage path (used as the key for download/delete).
 */
export async function uploadDocument(
  clientId: string,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const supabase = createAdminClient();

  // Sanitize filename: keep alphanumeric, dots, hyphens, underscores
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const storagePath = `${clientId}/${crypto.randomUUID()}-${sanitized}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`[Storage] Upload failed: ${error.message}`);
  }

  return storagePath;
}

/**
 * Generate a time-limited signed URL for downloading a document.
 */
export async function getDocumentUrl(
  storagePath: string
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(`[Storage] Signed URL failed: ${error?.message ?? "No URL"}`);
  }

  return data.signedUrl;
}

/**
 * Delete a document from Supabase Storage.
 */
export async function deleteDocumentFile(
  storagePath: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`[Storage] Delete failed: ${error.message}`);
  }
}
