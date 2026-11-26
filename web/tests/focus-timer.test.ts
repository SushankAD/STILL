import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { expireFocusCountdown, focusSecondsLeft, isFocusProofReady } from '../src/lib/focus-timer.ts'

const deadline = Date.parse('2026-11-25T14:25:00Z')
const ready = expireFocusCountdown(deadline, deadline)!

test('the final millisecond still displays a second and cannot open proof', () => {
  equal(focusSecondsLeft(deadline, deadline - 1), 1)
  equal(expireFocusCountdown(deadline, deadline - 1), null)
  equal(focusSecondsLeft(deadline, deadline), 0)
  equal(isFocusProofReady(ready, deadline), true)
  equal(ready.focusRemainingSeconds, 0)
  equal(ready.focusFinishedAt, deadline)
})

test('an expired countdown still opens proof after returning to the app', () => {
  const later = deadline + 100_000
  equal(focusSecondsLeft(deadline, later), 0)
  equal(isFocusProofReady(expireFocusCountdown(deadline, later)!, later), true)
})

test('active, paused, discarded, and older timer states cannot submit proof', () => {
  for (const invalid of [
    { ...ready, focusActive: true },
    { ...ready, focusPaused: true },
    { ...ready, focusProofPending: false },
    { ...ready, focusRemainingSeconds: 1 },
    { ...ready, focusEndsAt: deadline },
    { ...ready, focusFinishedAt: null },
    { ...ready, focusFinishedAt: deadline + 1 },
  ]) equal(isFocusProofReady(invalid, deadline), false)
})
