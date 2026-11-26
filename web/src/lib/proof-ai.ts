import { callProof } from './habit-api'
import { MAX_PROOF_BYTES, MAX_PROOF_DIMENSION } from '../../supabase/functions/_shared/proof-image'

export type ProofVerificationResult = { verified: boolean; confidence: number; reason: string }

export type PreparedImage = {
  blob: Blob
  dataUrl: string
  base64: string
  mimeType: 'image/jpeg'
  byteSize: number
}

export const proofImageTypes = 'image/jpeg,image/png,image/webp'

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the selected image file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The selected file is not a valid image.'))
    img.src = src
  })
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode the evidence image.')), 'image/jpeg', quality)
  })
}

export async function prepareProofImage(file: File): Promise<PreparedImage> {
  if (!proofImageTypes.split(',').includes(file.type) || file.size === 0 || file.size > 20 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG, or WebP image up to 20 MB.')
  }

  const source = URL.createObjectURL(file)
  try {
    const img = await loadImage(source)
    const scale = Math.min(1, MAX_PROOF_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Could not process an image in this browser.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    let blob = await encode(canvas, 0.88)
    if (blob.size > MAX_PROOF_BYTES) blob = await encode(canvas, 0.74)
    if (blob.size > MAX_PROOF_BYTES) throw new Error('This image is too large. Try cropping it or choosing a smaller image.')

    const dataUrl = await readAsDataUrl(blob)
    return { blob, dataUrl, base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', byteSize: blob.size }
  } finally {
    URL.revokeObjectURL(source)
  }
}

export function verifyFocusProofWithAI(image: PreparedImage, activity: string): Promise<ProofVerificationResult> {
  return callProof({ imageBase64: image.base64, mimeType: image.mimeType, activity, context: 'focus' })
}
