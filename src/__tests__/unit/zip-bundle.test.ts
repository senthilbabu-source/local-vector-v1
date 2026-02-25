// ---------------------------------------------------------------------------
// Unit test: ZIP bundle utility
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createZipBundle, type BundleFile } from '@/lib/utils/zipBundle';
import JSZip from 'jszip';

describe('createZipBundle', () => {
  it('creates a valid ZIP with the given files', async () => {
    const files: BundleFile[] = [
      { path: 'schema/restaurant.json', content: '{"@type":"Restaurant"}' },
      { path: 'llms.txt', content: '# Business Name\nTest data' },
    ];

    const buffer = await createZipBundle(files);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify contents by reading back
    const zip = await JSZip.loadAsync(buffer);
    const schemaFile = await zip.file('schema/restaurant.json')?.async('string');
    const llmsFile = await zip.file('llms.txt')?.async('string');

    expect(schemaFile).toBe('{"@type":"Restaurant"}');
    expect(llmsFile).toBe('# Business Name\nTest data');
  });

  it('returns a valid ZIP for an empty file list', async () => {
    const buffer = await createZipBundle([]);
    expect(buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
