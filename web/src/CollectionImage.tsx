import { useRef, useState } from 'react'
import { refreshCollectionImageUrl } from './lib/proof-api'
import type { CollectionPhoto } from './lib/proof-api'

export default function CollectionImage({ photo, thumbnail = false }: { photo: CollectionPhoto; thumbnail?: boolean }) {
  const [imageUrl, setImageUrl] = useState(photo.imageUrl)
  const [status, setStatus] = useState<'ready' | 'loading' | 'unavailable'>(photo.imageUrl ? 'ready' : 'unavailable')
  const attemptedRefresh = useRef(false)

  async function refreshImage() {
    if (!photo.objectPath) return
    attemptedRefresh.current = true
    setStatus('loading')
    try {
      setImageUrl(await refreshCollectionImageUrl(photo.objectPath))
      setStatus('ready')
    } catch {
      setStatus('unavailable')
    }
  }

  if (status === 'ready') {
    return (
      <img src={imageUrl} alt={photo.label} loading="lazy" onError={() => {
        if (photo.objectPath && !attemptedRefresh.current) void refreshImage()
        else setStatus('unavailable')
      }} />
    )
  }

  if (thumbnail) return <span className="collection-thumbnail-placeholder">{status === 'loading' ? '…' : 'Photo'}</span>

  return (
    <div className="collection-photo-placeholder">
      {status === 'loading' ? <span role="status">Loading photo…</span> : (
        <>
          <span>Photo unavailable</span>
          {photo.objectPath && <button className="ghost-btn" type="button" onClick={() => { void refreshImage() }}>Retry photo</button>}
        </>
      )}
    </div>
  )
}
