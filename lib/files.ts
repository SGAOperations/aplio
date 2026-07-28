// Pure, environment-agnostic helpers shared between the file-answer server
// action and the client components that render/upload file answers. No
// 'server-only' here — question-file-field.tsx and answer-file-link.tsx both
// import from this module.
import { FILE_UPLOAD_MIME_TYPES } from '@/lib/constants';
import type { QuestionFileTarget } from '@/lib/types';

type SniffableMimeType = (typeof FILE_UPLOAD_MIME_TYPES)[number];

/**
 * Identifies a file's real type from its magic bytes, ignoring the
 * client-supplied (and spoofable) `file.type`. Returns null when the bytes
 * match none of the allow-listed signatures.
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

// Collapses a filename's stem to a safe, bounded token for a Blob pathname —
// no traversal, no unexpected extensions (the extension always comes from the
// sniffed MIME type, never from this stem or client input).
function sanitizeStem(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^./\\]*$/, '');
  const collapsed = withoutExtension.replace(/[^a-zA-Z0-9._-]/g, '-');
  const stripped = collapsed.replace(/^\.+/, '');
  const truncated = stripped.slice(0, 64);
  return truncated || 'file';
}

/**
 * Builds the Blob store pathname for a file answer. Scoped by question so
 * replacing an answer overwrites the same logical slot (addRandomSuffix
 * still guarantees a unique object per upload).
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
