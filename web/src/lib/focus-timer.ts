type FocusProofState = {
  focusActive: boolean
  focusPaused: boolean
  focusProofPending: boolean
  focusRemainingSeconds: number
  focusEndsAt: number | null
  focusFinishedAt: number | null
}

export function focusSecondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function expireFocusCountdown(deadline: number, now: number): (FocusProofState & { focusProgress: number }) | null {
  if (!Number.isFinite(deadline) || now < deadline) return null
  return {
    focusActive: false,
    focusPaused: false,
    focusProofPending: true,
    focusRemainingSeconds: 0,
    focusEndsAt: null,
    focusFinishedAt: deadline,
    focusProgress: 100,
  }
}

export function isFocusProofReady(timer: FocusProofState, now: number): boolean {
  return timer.focusProofPending && !timer.focusActive && !timer.focusPaused &&
    timer.focusRemainingSeconds === 0 && timer.focusEndsAt === null &&
    timer.focusFinishedAt !== null && Number.isFinite(timer.focusFinishedAt) && timer.focusFinishedAt <= now
}
