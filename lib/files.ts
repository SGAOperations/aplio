// Deliberately not 'server-only': the file-answer client components import from here too.
import { FILE_UPLOAD_MIME_TYPES } from '@/lib/constants';
import type { QuestionFileTarget } from '@/lib/types';

type SniffableMimeType = (typeof FILE_UPLOAD_MIME_TYPES)[number];

/**
 * Reads the real type from magic bytes, ignoring the spoofable `file.type`.
 */
export function sniffMimeType(bytes: Uint8Array): SniffableMimeType | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
    return 'application/pdf'; // %PDF

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'image/jpeg';

  return null;
}

// Bounds the stem against path traversal. The extension always comes from the
// sniffed MIME type, never from here.
function sanitizeStem(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^./\\]*$/, '');
  const collapsed = withoutExtension.replace(/[^a-zA-Z0-9._-]/g, '-');
  const stripped = collapsed.replace(/^\.+/, '');
  const truncated = stripped.slice(0, 64);
  return truncated || 'file';
}

/**
 * Scoped by question so replacing an answer reuses the same logical slot.
 */
export function buildAnswerFilePathname(
  target: QuestionFileTarget,
  userId: string,
  originalName: string,
  ext: string,
): string {
  const stem = sanitizeStem(originalName);
  const base =
    target.scope === 'profile'
      ? `answers/profile/${userId}/${target.questionId}`
      : `answers/applications/${target.applicationId}/${target.questionId}`;
  return `${base}/${stem}.${ext}`;
}

/** Decodes the last path segment of a blob URL for display as a filename. */
export function getFileDisplayName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').pop() ?? '';
    return decodeURIComponent(last) || 'file';
  } catch {
    return 'file';
  }
}
