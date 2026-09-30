const MAX_BYTES = 2 * 1024 * 1024

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export function validateImageFile(bytes: Uint8Array, size = bytes.byteLength): { ok: true; mime: ImageMime } | { ok: false; reason: string } {
  if (size <= 0 || bytes.byteLength === 0) return { ok: false, reason: 'fichier vide' }
  if (size > MAX_BYTES || bytes.byteLength > MAX_BYTES) return { ok: false, reason: '2 Mo maximum' }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ok: true, mime: 'image/jpeg' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ok: true, mime: 'image/png' }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ok: true, mime: 'image/webp' }
  }
  return { ok: false, reason: 'JPEG, PNG ou WebP seulement' }
}
