/**
 * Client-safe file URL utilities.
 * These functions contain no server-only imports and can be used in both
 * server and client components.
 */

/**
 * Decode an ImageKit encoded URL back to the plain public URL.
 * Format stored in DB: "ik://fileId|https://ik.imagekit.io/..."
 *
 * Works identically to getPublicUrl() in imagekit.ts but safe to import
 * from client components (no process.env dependencies).
 */
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('ik://')) {
    const rest = url.slice(5)
    const pipeIdx = rest.indexOf('|')
    if (pipeIdx >= 0) return rest.slice(pipeIdx + 1)
  }
  return url
}

/**
 * Resolve multiple URL fields on an object at once.
 * Returns a new object with all ik:// URLs unwrapped to plain public URLs.
 */
export function resolveUrls<T extends Record<string, unknown>>(obj: T, ...fields: (keyof T)[]): T {
  const result = { ...obj }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string') {
      result[field] = resolveFileUrl(val) as T[keyof T]
    }
  }
  return result
}
