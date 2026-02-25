// ---------------------------------------------------------------------------
// lib/utils/zipBundle.ts — ZIP Bundle Generator
//
// Wraps JSZip for the One-Click AI-Ready Package download feature
// (Killer Feature #3). Generates a downloadable ZIP containing:
//   - JSON-LD schema files
//   - llms.txt
//   - robots.txt additions
//   - FAQ content blocks
//   - Entity statement
//
// This file is a scaffold — the actual bundle logic will be built
// when Feature #3 development begins.
//
// AI_RULES §5: No API calls on load. ZIP generation is user-triggered only.
// ---------------------------------------------------------------------------

import JSZip from 'jszip';

export interface BundleFile {
  /** File path inside the ZIP (e.g. "schema/restaurant.json") */
  path: string;
  /** File content as a string */
  content: string;
}

/**
 * Creates a ZIP buffer from an array of files.
 * Returns a Node.js Buffer suitable for streaming as a response body.
 *
 * Usage (in a future API route):
 * ```ts
 * const buffer = await createZipBundle(files);
 * return new Response(buffer, {
 *   headers: {
 *     'Content-Type': 'application/zip',
 *     'Content-Disposition': 'attachment; filename="ai-ready-package.zip"',
 *   },
 * });
 * ```
 */
export async function createZipBundle(files: BundleFile[]): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}
