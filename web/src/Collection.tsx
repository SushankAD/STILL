import { useEffect, useMemo, useState } from 'react'
import CollectionImage from './CollectionImage'
import { calendarMonthDays, localDateString } from './lib/calendar'
import { fetchCollectionPhotos } from './lib/proof-api'
import type { CollectionPhoto } from './lib/proof-api'

type LoadStatus = 'loading' | 'ready' | 'error'

export default function Collection({ photos, userId, status, onRetry }: {
  photos: CollectionPhoto[]
  userId?: string
  status: LoadStatus
  onRetry: () => void
}) {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(() => localDateString())
  const [monthPhotos, setMonthPhotos] = useState<CollectionPhoto[]>([])
  const [monthStatus, setMonthStatus] = useState<LoadStatus>(userId ? 'loading' : 'ready')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!userId || view !== 'calendar') return
    let active = true
    let version = 0
    const refresh = () => {
      const request = ++version
      setMonthStatus('loading')
      void fetchCollectionPhotos(userId, month).then((nextPhotos) => {
        if (!active || request !== version) return
        setMonthPhotos(nextPhotos)
        setMonthStatus('ready')
      }).catch(() => {
        if (active && request === version) setMonthStatus('error')
      })
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('online', refreshVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('online', refreshVisible)
    }
  }, [userId, view, month, retry])

  const dates = useMemo(() => calendarMonthDays(month), [month])
  const photosByDay = useMemo(() => {
    const grouped = new Map<string, CollectionPhoto[]>()
    for (const photo of userId ? monthPhotos : photos) {
      const date = new Date(photo.createdAt)
      if (Number.isNaN(date.getTime())) continue
      const key = localDateString(date)
      grouped.set(key, [...(grouped.get(key) ?? []), photo])
    }
    return grouped
  }, [userId, monthPhotos, photos])
  const selectedPhotos = photosByDay.get(selectedDay) ?? []
  const proofCount = view === 'calendar'
    ? dates.reduce((total, date) => total + (date ? photosByDay.get(localDateString(date))?.length ?? 0 : 0), 0)
    : photos.length
  const loading = view === 'calendar' && userId ? monthStatus : status
  const today = localDateString()
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function changeMonth(step: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + step, 1)
    setMonth(next)
    setSelectedDay(localDateString(next))
  }

  function photoCard(photo: CollectionPhoto) {
    return (
      <article className="collection-photo" key={photo.id}>
        <CollectionImage key={photo.imageUrl} photo={photo} />
        <div>
          <strong>{photo.label}</strong>
          <span>{photo.kind === 'focus' ? 'Focus' : 'Habit'} · {new Date(photo.createdAt).toLocaleDateString()}</span>
        </div>
      </article>
    )
  }

  return (
    <section>
      <div className="section-title" style={{ marginTop: 0 }}><h2>Collection</h2><p>{proofCount} {proofCount === 1 ? 'proof' : 'proofs'}{view === 'calendar' ? ' this month' : ''}</p></div>
      <div className="collection-view-switch" role="group" aria-label="Collection view">
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
      </div>
      {loading === 'error' && (
        <div className="message-card" role="alert">
          <strong>Could not refresh Collection.</strong>
          <button className="ghost-btn" type="button" onClick={() => {
            if (view === 'calendar' && userId) setRetry((attempt) => attempt + 1)
            else onRetry()
          }}>Retry Collection</button>
        </div>
      )}
      {loading === 'loading' && <p className="collection-loading" role="status">Loading photos…</p>}
      {view === 'list' ? (
        photos.length ? <div className="collection-grid">{photos.map(photoCard)}</div> : loading === 'ready' && (
          <div className="message-card"><strong>Nothing collected yet.</strong><p>Save accepted habit photos or focus proof to see them here.</p></div>
        )
      ) : (
        <>
          <div className="collection-month-heading">
            <button className="ghost-btn" type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <h3 aria-live="polite">{monthLabel}</h3>
            <button className="ghost-btn" type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="collection-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="collection-calendar-grid" role="group" aria-label={`${monthLabel} photos`}>
            {dates.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} aria-hidden="true" />
              const key = localDateString(date)
              const dayPhotos = photosByDay.get(key) ?? []
              return (
                <button key={key} className={`collection-calendar-day${dayPhotos.length ? ' has-photo' : ''}${key === today ? ' is-today' : ''}`}
                  type="button" aria-pressed={key === selectedDay} aria-current={key === today ? 'date' : undefined}
                  aria-label={`${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}, ${dayPhotos.length} ${dayPhotos.length === 1 ? 'proof' : 'proofs'}`}
                  onClick={() => setSelectedDay(key)}>
                  {dayPhotos[0] && <CollectionImage key={dayPhotos[0].imageUrl} photo={dayPhotos[0]} thumbnail />}
                  <span className="collection-day-number">{date.getDate()}</span>
                  {dayPhotos.length > 1 && <span className="collection-day-extra" aria-hidden="true">+{dayPhotos.length - 1}</span>}
                </button>
              )
            })}
          </div>
          <section className="collection-selected-day" aria-live="polite">
            <div className="section-title">
              <h3>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
              <p>{selectedPhotos.length} {selectedPhotos.length === 1 ? 'proof' : 'proofs'}</p>
            </div>
            {selectedPhotos.length ? <div className="collection-day-gallery">{selectedPhotos.map(photoCard)}</div> : (
              loading === 'ready' && <p className="collection-empty-day">No proofs saved on this day.</p>
            )}
          </section>
        </>
      )}
    </section>
  )
}
