import { useCallback, useEffect, useRef, useState } from 'react'
import { proofImageTypes } from './lib/proof-ai'

type Props = {
  disabled: boolean
  hasImage: boolean
  onSelect: (file: File) => void
  allowCamera?: boolean
  chooseLabel?: string
}

export default function ProofPhotoInput({
  disabled, hasImage, onSelect, allowCamera = true, chooseLabel = 'Choose photo',
}: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const camera = useRef({ stream: null as MediaStream | null, request: 0, busy: false })
  const nativeCamera = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const closeCamera = useCallback(() => {
    stopCamera(camera.current)
    if (video.current) video.current.srcObject = null
    setCameraOpen(false)
    setReady(false)
  }, [])

  useEffect(() => {
    const session = camera.current
    function stopHiddenCamera() {
      if (document.visibilityState === 'hidden') closeCamera()
    }
    document.addEventListener('visibilitychange', stopHiddenCamera)
    return () => {
      stopCamera(session)
      document.removeEventListener('visibilitychange', stopHiddenCamera)
    }
  }, [closeCamera])

  async function openCamera() {
    const session = camera.current
    if (disabled || session.busy || cameraOpen) return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      nativeCamera.current?.click()
      return
    }
    session.busy = true
    const id = ++session.request
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        audio: false,
      })
      if (id !== session.request) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      session.stream = stream
      if (video.current) {
        video.current.srcObject = stream
        await video.current.play()
      }
      if (id === session.request) setReady(true)
    } catch (failure) {
      if (id !== session.request) return
      closeCamera()
      setError(failure instanceof DOMException && failure.name === 'NotAllowedError'
        ? 'Allow camera access in your browser settings, then try Take photo again.'
        : 'Could not open the camera. Check that a camera is connected and available.')
    } finally {
      if (id === session.request) session.busy = false
    }
  }

  async function capturePhoto() {
    const session = camera.current
    if (!ready || disabled || session.busy || !video.current) return
    session.busy = true
    const id = session.request
    const source = video.current
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
    canvas.width = Math.round(source.videoWidth * scale)
    canvas.height = Math.round(source.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context || !canvas.width || !canvas.height) {
      session.busy = false
      setError('The camera is not ready. Wait a moment and try again.')
      return
    }
    let photo: Blob | null = null
    try {
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    } catch {
      // The video can lose its frame while the device is switching cameras.
    }
    if (id === session.request) {
      session.busy = false
      if (photo) {
        closeCamera()
        setError('')
        onSelect(new File([photo], 'camera-photo.jpg', { type: 'image/jpeg' }))
      } else {
        setError('Could not take the photo. Please try again.')
      }
    }
  }

  function selectFile(file?: File) {
    if (!file || disabled) return
    closeCamera()
    setError('')
    onSelect(file)
  }

  return (
    <>
      <div className="proof-inputs">
        {allowCamera && (
          <button className="ghost-btn" type="button" disabled={disabled || cameraOpen}
            onClick={() => { void openCamera() }}>Take photo</button>
        )}
        <label className="ghost-btn proof-picker" aria-disabled={disabled}>
          {hasImage ? 'Change photo' : chooseLabel}
          <input type="file" accept={proofImageTypes} disabled={disabled}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              selectFile(file)
            }} />
        </label>
        {allowCamera && (
          <input ref={nativeCamera} type="file" accept={proofImageTypes} capture="environment" hidden disabled={disabled}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              selectFile(file)
            }} />
        )}
      </div>
      <div className="proof-camera" aria-label="Camera" hidden={!cameraOpen}>
        <video ref={video} autoPlay muted playsInline aria-label="Live camera preview"
          onError={() => { closeCamera(); setError('Could not show the camera preview. Try Take photo again.') }} />
        {cameraOpen && !ready && <p role="status">Opening camera…</p>}
        <div className="proof-inputs">
          <button className="primary-btn" type="button" disabled={!ready || disabled}
            onClick={() => { void capturePhoto() }}>Capture photo</button>
          <button className="ghost-btn" type="button" onClick={closeCamera}>Cancel camera</button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

function stopCamera(camera: { stream: MediaStream | null; request: number; busy: boolean }) {
  camera.request++
  camera.busy = false
  camera.stream?.getTracks().forEach((track) => track.stop())
  camera.stream = null
}
