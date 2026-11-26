import { useEffect, useRef, useState } from 'react'
import {
  deviceTimezone, fetchHabitPolicy, recordHabitCompletion, verifyHabitProof,
} from './lib/habit-api'
import type { HabitCompletion, HabitProofContext, HabitProofResult, HabitRecord } from './lib/habit-api'
import {
  allowsSelfReport, DEFAULT_SOCIAL_WINDOW, findTemplate, habitDate,
} from '../supabase/functions/_shared/habit-policy'
import { predefinedPolicy } from '../supabase/functions/_shared/habit-predefined'
import { prepareProofImage, proofImageTypes } from './lib/proof-ai'
import type { PreparedImage } from './lib/proof-ai'

const statusLabels = {
  ACCEPTED: 'Evidence accepted',
  PARTIAL: 'Partial evidence',
  UNCERTAIN: 'Evidence unclear',
  REJECTED: 'Evidence did not match',
}

type Props = {
  habit: HabitRecord
  userId?: string
  onClose: () => void
  onComplete: (saved: HabitCompletion, photoSaved?: boolean) => void
  onAlreadyComplete: () => void
}

function previewPolicy(habit: HabitRecord): HabitProofContext | null {
  const template = findTemplate(habit.title)
  if (!template) return null
  const socialWindow = habit.socialWindow ?? DEFAULT_SOCIAL_WINDOW
  const policy = predefinedPolicy(template, habit.title, socialWindow)
  const timezone = deviceTimezone()
  return {
    template, policy, timezone, socialWindow,
    habitDate: habitDate(new Date(), timezone, template, policy.dateBasis, socialWindow.endHour),
    policyRevision: '',
    selfReportAllowed: allowsSelfReport(policy, template),
  }
}

export default function HabitProof({ habit, userId, onClose, onComplete, onAlreadyComplete }: Props) {
  const [context, setContext] = useState<HabitProofContext | null>(() => userId ? null : previewPolicy(habit))
  const [policyError, setPolicyError] = useState('')
  const [retry, setRetry] = useState(0)
  const [name, setName] = useState('')
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [checked, setChecked] = useState<HabitProofResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [keepPhoto, setKeepPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const selfReportId = useRef<string | null>(null)
  const card = useRef<HTMLDivElement>(null)

  useEffect(() => { card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [])
  useEffect(() => {
    if (!userId) return
    let active = true
    fetchHabitPolicy(userId, String(habit.id))
      .then((policy) => { if (active) setContext(policy) })
      .catch((error: Error) => { if (active) setPolicyError(error.message) })
    return () => { active = false }
  }, [habit.id, userId, retry])

  function reloadPolicy() {
    setContext(null)
    setPolicyError('')
    setChecked(null)
    setCheckError('')
    setSaveError('')
    selfReportId.current = null
    setRetry((attempt) => attempt + 1)
  }

  async function checkImage(file?: File) {
    if (!context || !userId || busy.current || (!file && !image)) return
    busy.current = true
    setChecking(true)
    setChecked(null)
    setCheckError('')
    setSaveError('')
    setKeepPhoto(false)
    if (file) {
      setName(file.name)
      setImage(null)
    }
    try {
      const prepared = file ? await prepareProofImage(file) : image!
      setImage(prepared)
      setChecked(await verifyHabitProof(String(habit.id), context, prepared))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not check the evidence. Please try again.'
      setCheckError(message)
      if (message.includes('already complete')) onAlreadyComplete()
    } finally {
      busy.current = false
      setChecking(false)
    }
  }

  async function submit(selfReport: boolean) {
    if (!context || !userId || busy.current || (!selfReport && !checked?.verificationId)) return
    busy.current = true
    setSubmitting(true)
    setSaveError('')
    try {
      const attemptId = selfReport ? (selfReportId.current ??= crypto.randomUUID()) : checked!.verificationId!
      const saved = await recordHabitCompletion(String(habit.id), context, attemptId, selfReport,
        !selfReport && keepPhoto ? image ?? undefined : undefined)
      onComplete(saved.completion, saved.photoSaved)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the habit. Please try again.'
      setSaveError(message)
      if (message.includes('already complete')) onAlreadyComplete()
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  const policy = context?.policy
  const acceptsImage = policy?.safetyStatus === 'ALLOWED' && policy.verificationMode !== 'SELF_REPORT'
  const screenshotOnly = policy?.verificationMode === 'SCREENSHOT'
  const reportFirst = screenshotOnly || context?.template === 'sleep'
  const chooseLabel = context?.template === 'social' || context?.template === 'sleep'
    ? 'Choose report image'
    : screenshotOnly ? 'Choose screenshot' : 'Choose image'
  const outcome = checked?.result
  const date = context && new Date(`${context.habitDate}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })

  const photoPicker = (capture?: 'environment') => (
    <label className="ghost-btn proof-picker" aria-disabled={checking || submitting}>
      {capture ? 'Take photo' : image ? 'Change image' : chooseLabel}
      <input
        type="file"
        accept={proofImageTypes}
        capture={capture}
        disabled={checking || submitting}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void checkImage(file)
        }}
      />
    </label>
  )

  return (
    <div className="proof-card habit-proof" ref={card}>
      <div className="emoji-badge mint-icon" aria-hidden="true">{habit.icon}</div>
      <strong>Proof for {habit.title}</strong>
      {userId && !policy && !policyError && <p role="status">Loading evidence instructions…</p>}
      {policyError && (
        <div role="alert">
          <p>{policyError}</p>
          <button type="button" className="ghost-btn" onClick={reloadPolicy}>Retry instructions</button>
        </div>
      )}
      {context && policy && (
        <>
          <p>{policy.userInstruction}</p>
          {policy.safetyStatus === 'ALLOWED' && (
            <>
              <p className="proof-name">Habit date {date} · {context.timezone}</p>
              {context.template === 'sleep' && <p>Use the date you fell asleep, even if your tracker lists the report under the next morning.</p>}
              {context.template === 'social' && (
                <p>Use the latest finished window shown above, from midnight to {context.socialWindow.endHour === 24 ? 'the next midnight' : `${String(context.socialWindow.endHour).padStart(2, '0')}:00`}. Limit {context.socialWindow.limitMinutes} min.</p>
              )}
              {acceptsImage && <p>{policy.privacyGuidance}</p>}
            </>
          )}
        </>
      )}
      {!userId && <p>Connect a STILL account to verify evidence and earn roots.</p>}
      {userId && acceptsImage && (
        <>
          <div className="proof-inputs">{photoPicker()}{!reportFirst && photoPicker('environment')}</div>
          {name && <p className="proof-name">{name}</p>}
          {image && <img className="proof-preview" src={image.dataUrl} alt="Selected habit evidence" />}
          {checking && <p role="status">Checking evidence…</p>}
          {checkError && <p role="alert">{checkError}</p>}
          {outcome && (
            <div className="message-card" role="status">
              <strong>{checked.method === 'tracked' ? 'Tracking report accepted' : statusLabels[outcome.status]}</strong>
              <p>{outcome.userMessage}</p>
              {outcome.retryInstruction && outcome.status !== 'ACCEPTED' && <p>{outcome.retryInstruction}</p>}
            </div>
          )}
          {checked?.method === 'photo' && (
            <label className="proof-keep">
              <input type="checkbox" checked={keepPhoto} onChange={(event) => setKeepPhoto(event.target.checked)} disabled={submitting} />
              Keep a copy in Collection
            </label>
          )}
          {image && (checkError || saveError) && (
            <div className="proof-inputs">
              <button type="button" className="ghost-btn" disabled={checking || submitting} onClick={() => { void checkImage() }}>Check image again</button>
              <button type="button" className="ghost-btn" disabled={checking || submitting} onClick={reloadPolicy}>Refresh instructions</button>
            </div>
          )}
        </>
      )}
      {saveError && <p role="alert">{saveError}</p>}
      {saveError && !image && (
        <button type="button" className="ghost-btn" disabled={submitting} onClick={reloadPolicy}>Refresh instructions</button>
      )}
      {userId && context?.selfReportAllowed && (
        <div className="message-card">
          {context.template === 'sleep' && <p>If you fell asleep before 11 PM and have no tracking report, you can record it as self-reported.</p>}
          <button type="button" className="ghost-btn" disabled={checking || submitting} onClick={() => { void submit(true) }}>
            {submitting ? 'Saving…' : `Record as self-reported (+${habit.baseRoots})`}
          </button>
        </div>
      )}
      <div className="proof-inputs proof-actions">
        <button type="button" className="ghost-btn" disabled={submitting} onClick={onClose}>Cancel</button>
        {userId && acceptsImage && (
          <button
            type="button"
            className="primary-btn"
            disabled={!checked?.verificationId || checking || submitting}
            onClick={() => { void submit(false) }}
          >
            {submitting ? 'Saving…' : `Save evidence (+${habit.baseRoots})`}
          </button>
        )}
      </div>
    </div>
  )
}

