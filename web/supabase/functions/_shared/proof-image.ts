export const MAX_PROOF_BYTES = 2 * 1024 * 1024
export const MAX_PROOF_DIMENSION = 1600

// The client transcodes supported uploads to JPEG. Check the decoded envelope,
// frame dimensions and start of scan before forwarding it to the image decoder.
export function readProofImage(mimeType: unknown, base64: unknown) {
  if (mimeType !== 'image/jpeg' || typeof base64 !== 'string' ||
    base64.length > Math.ceil(MAX_PROOF_BYTES / 3) * 4 || base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null

  const raw = atob(base64)
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0))
  if (bytes.length < 12 || bytes.length > MAX_PROOF_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
    bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null

  let frameFound = false
  for (let i = 2; i + 4 < bytes.length;) {
    if (bytes[i++] !== 0xff) return null
    while (bytes[i] === 0xff) i++
    const marker = bytes[i++]
    const length = bytes[i] * 256 + bytes[i + 1]
    if (!Number.isFinite(length) || length < 2 || i + length > bytes.length - 2) return null
    if (marker === 0xda) {
      return frameFound && length >= 6 && i + length < bytes.length - 2
        ? { mimeType, imageBase64: base64, bytes } as const
        : null
    }
    if (marker === 0xc0 || marker === 0xc2) {
      if (frameFound || length < 11) return null
      const height = bytes[i + 3] * 256 + bytes[i + 4]
      const width = bytes[i + 5] * 256 + bytes[i + 6]
      const channels = bytes[i + 7]
      if (length !== 8 + 3 * channels || ![1, 3].includes(channels) ||
        !width || !height || Math.max(width, height) > MAX_PROOF_DIMENSION) return null
      frameFound = true
    }
    i += length
  }
  return null
}
