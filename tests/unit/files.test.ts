import { describe, expect, it } from 'vitest';

import { base64ToBlob, getFilePreviewKind } from '@/lib/files';

describe('base64ToBlob', () => {
  it('round-trips bytes and sets the content type', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const base64 = Buffer.from(bytes).toString('base64');

    const blob = base64ToBlob(base64, 'application/pdf');

    expect(blob.type).toBe('application/pdf');
    const roundTripped = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(roundTripped)).toEqual(Array.from(bytes));
  });
});

describe('getFilePreviewKind', () => {
  it('maps application/pdf to pdf', () => {
    expect(getFilePreviewKind('application/pdf')).toBe('pdf');
  });

  it('maps image/png to image', () => {
    expect(getFilePreviewKind('image/png')).toBe('image');
  });

  it('maps image/jpeg to image', () => {
    expect(getFilePreviewKind('image/jpeg')).toBe('image');
  });

  it('maps an unknown content type to unsupported', () => {
    expect(getFilePreviewKind('text/plain')).toBe('unsupported');
  });
});
