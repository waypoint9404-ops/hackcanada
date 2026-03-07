/**
 * Server-side PDF text extraction using pdf-parse (v1).
 * Handles text-layer PDFs. Scanned image-only PDFs return empty text.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export interface PdfExtractionResult {
  text: string;
  pages: number;
  /** True if extraction returned no text (likely a scanned image PDF) */
  isEmpty: boolean;
}

/**
 * Extract text content from a PDF buffer.
 * Returns extracted text, page count, and whether the result was empty.
 */
export async function extractTextFromPdf(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  try {
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? "";
    return {
      text,
      pages: result.numpages ?? 0,
      isEmpty: text.length === 0,
    };
  } catch (err) {
    console.error("[pdf-extract] Failed to parse PDF:", err);
    return {
      text: "",
      pages: 0,
      isEmpty: true,
    };
  }
}
