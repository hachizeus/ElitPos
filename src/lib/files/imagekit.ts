/**
 * ImageKit upload adapter.
 *
 * Uses ImageKit's Upload API v2 directly via fetch — no SDK required.
 * Docs: https://docs.imagekit.io/api-reference/upload-file-api
 *
 * Only used for images (MIME type starts with "image/").
 * PDFs, CSVs, and other non-image files continue to use R2.
 */

const IK_UPLOAD_URL = 'https://upload.imagekit.io/api/v2/files/upload'
const IK_URL_ENDPOINT = (process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/elitpos').replace(/\/$/, '')
const IK_FOLDER      = process.env.IMAGEKIT_FOLDER || 'elitpos'
const IK_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY || ''
const IK_PUBLIC_KEY  = process.env.IMAGEKIT_PUBLIC_KEY  || ''

export function imagekitEnabled(): boolean {
  return !!(IK_PRIVATE_KEY && IK_PUBLIC_KEY)
}

/** Returns true for MIME types that should go through ImageKit */
export function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/')
}

export interface ImageKitUploadResult {
  url: string          // full CDN URL returned by ImageKit
  fileId: string       // ImageKit file ID (for deletes)
  name: string
  size: number
  width?: number
  height?: number
}

/**
 * Upload a buffer to ImageKit and return the CDN URL.
 *
 * @param buffer      File content
 * @param fileName    Desired file name (without folder prefix)
 * @param contentType MIME type e.g. "image/jpeg"
 * @param folder      Optional sub-folder path inside IMAGEKIT_FOLDER
 */
export async function uploadToImageKit(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  folder?: string,
): Promise<ImageKitUploadResult> {
  if (!IK_PRIVATE_KEY) {
    throw new Error('IMAGEKIT_PRIVATE_KEY is not set')
  }

  // ImageKit expects Basic auth with privateKey as username, empty password
  const auth = Buffer.from(`${IK_PRIVATE_KEY}:`).toString('base64')

  const folderPath = folder
    ? `/${IK_FOLDER}/${folder}`.replace(/\/+/g, '/')
    : `/${IK_FOLDER}`

  // Build multipart form
  const form = new FormData()
  form.append('publicKey',  IK_PUBLIC_KEY)
  form.append('fileName',   fileName)
  form.append('folder',     folderPath)
  form.append('useUniqueFileName', 'true')

  // Convert buffer to Blob for FormData
  const blob = new Blob([buffer], { type: contentType })
  form.append('file', blob, fileName)

  const res = await fetch(IK_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(`ImageKit upload failed: ${res.status} ${err.message || res.statusText}`)
  }

  const data = await res.json() as {
    url: string
    fileId: string
    name: string
    size: number
    width?: number
    height?: number
  }

  return {
    url:    data.url,
    fileId: data.fileId,
    name:   data.name,
    size:   data.size,
    width:  data.width,
    height: data.height,
  }
}

/**
 * Delete a file from ImageKit by its file ID.
 * The fileId is returned by uploadToImageKit and stored in the DB fileUrl
 * with a special prefix: "ik://{fileId}:{url}"
 */
export async function deleteFromImageKit(fileId: string): Promise<boolean> {
  if (!IK_PRIVATE_KEY) return false
  const auth = Buffer.from(`${IK_PRIVATE_KEY}:`).toString('base64')
  try {
    const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}` },
    })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

/**
 * Encode an ImageKit URL + fileId into a storable string.
 * Format: "ik://{fileId}|{publicUrl}"
 * The public URL is used everywhere for display; fileId is only needed for deletion.
 */
export function encodeImageKitUrl(fileId: string, url: string): string {
  return `ik://${fileId}|${url}`
}

/**
 * Decode an ImageKit encoded URL back to { fileId, url }.
 * Returns null if the string is not an ImageKit URL.
 */
export function decodeImageKitUrl(encoded: string): { fileId: string; url: string } | null {
  if (!encoded.startsWith('ik://')) return null
  const rest = encoded.slice(5) // strip "ik://"
  const pipeIdx = rest.indexOf('|')
  if (pipeIdx < 0) return null
  return {
    fileId: rest.slice(0, pipeIdx),
    url:    rest.slice(pipeIdx + 1),
  }
}

/**
 * Get the public display URL from any stored file URL.
 * Works for both ImageKit encoded URLs and plain CDN/R2 URLs.
 */
export function getPublicUrl(storedUrl: string): string {
  const ik = decodeImageKitUrl(storedUrl)
  return ik ? ik.url : storedUrl
}

/**
 * Build an ImageKit transformation URL for thumbnails/resizing.
 * Example: imagekitTransform(url, { width: 400, height: 400, format: 'webp' })
 */
export function imagekitTransform(
  url: string,
  opts: { width?: number; height?: number; quality?: number; format?: string }
): string {
  // Resolve to raw URL first
  const raw = getPublicUrl(url)
  if (!raw.includes('imagekit.io')) return raw  // not an ImageKit URL, return as-is

  const parts: string[] = []
  if (opts.width)   parts.push(`w-${opts.width}`)
  if (opts.height)  parts.push(`h-${opts.height}`)
  if (opts.quality) parts.push(`q-${opts.quality}`)
  if (opts.format)  parts.push(`f-${opts.format}`)
  if (parts.length === 0) return raw

  // Insert transformation path segment after endpoint
  const endpoint = IK_URL_ENDPOINT
  if (raw.startsWith(endpoint)) {
    return `${endpoint}/tr:${parts.join(',')}${raw.slice(endpoint.length)}`
  }
  return raw
}
