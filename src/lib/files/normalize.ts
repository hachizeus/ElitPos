/**
 * URL normalization utilities for API responses.
 *
 * ImageKit URLs are stored as "ik://fileId|publicUrl" so we can delete by fileId.
 * Before returning to the frontend, all URLs must be unwrapped to plain public URLs.
 */
import { decodeImageKitUrl } from './imagekit'

/**
 * Unwrap a stored file URL to a plain public URL.
 * - "ik://fileId|https://ik.imagekit.io/..." → "https://ik.imagekit.io/..."
 * - Any other URL is returned as-is.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  const ik = decodeImageKitUrl(url)
  return ik ? ik.url : url
}

/**
 * Normalize all URL fields in a file/record object before sending to the client.
 * Handles: fileUrl, thumbnailUrl, imageUrl, logoUrl, avatarUrl, diagramUrl
 */
export function normalizeFileRecord<T extends Record<string, unknown>>(record: T): T {
  const URL_FIELDS = ['fileUrl', 'thumbnailUrl', 'imageUrl', 'logoUrl', 'avatarUrl', 'diagramUrl', 'receiptUrl', 'imageUrl']
  const result = { ...record }
  for (const field of URL_FIELDS) {
    if (field in result && typeof result[field] === 'string') {
      result[field] = normalizeUrl(result[field] as string)
    }
  }
  return result
}

/**
 * Normalize an array of file records.
 */
export function normalizeFileRecords<T extends Record<string, unknown>>(records: T[]): T[] {
  return records.map(normalizeFileRecord)
}
