// Self-contained Web Audio API chime and ringtone generator.
// Requires no external audio files, works offline in PWA, and conforms to mobile autoplay policies.

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioCtxClass) return null

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtxClass()
  }
  return sharedAudioCtx
}

/**
 * Pre-warm/unlock the audio context on user gesture (e.g. clicking Start Timer).
 */
export function unlockAudio(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume()
  }
}

/**
 * Plays a single resonant bell chime note with natural harmonic decay.
 */
function playBellNote(ctx: AudioContext, frequency: number, startTime: number, duration: number, gainValue = 0.28): void {
  // Fundamental tone
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()

  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(frequency, startTime)

  gain1.gain.setValueAtTime(0.0001, startTime)
  gain1.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.015)
  gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc1.connect(gain1)
  gain1.connect(ctx.destination)

  osc1.start(startTime)
  osc1.stop(startTime + duration)

  // Soft octave overtone for metallic warmth
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()

  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(frequency * 2.01, startTime)

  gain2.gain.setValueAtTime(0.0001, startTime)
  gain2.gain.exponentialRampToValueAtTime(gainValue * 0.25, startTime + 0.02)
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7)

  osc2.connect(gain2)
  gain2.connect(ctx.destination)

  osc2.start(startTime)
  osc2.stop(startTime + duration)
}

/**
 * Plays a soothing timer completion ringtone (pleasant 4-note ascending chime sequence repeated twice).
 */
export function playCompletionRingtone(): void {
  try {
    // Mobile haptic vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([250, 120, 250, 120, 450])
    }

    const ctx = getAudioContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime
    // Chime notes: E5, G#5, B5, E6 (peaceful meditative chord)
    const melody = [
      { freq: 659.25, delay: 0.0, len: 1.4 },
      { freq: 830.61, delay: 0.35, len: 1.4 },
      { freq: 987.77, delay: 0.70, len: 1.5 },
      { freq: 1318.51, delay: 1.05, len: 2.4 },
      // Second phrase
      { freq: 830.61, delay: 2.1, len: 1.2 },
      { freq: 987.77, delay: 2.45, len: 1.3 },
      { freq: 1318.51, delay: 2.8, len: 1.4 },
      { freq: 1661.22, delay: 3.15, len: 3.0 },
    ]

    for (const note of melody) {
      playBellNote(ctx, note.freq, now + note.delay, note.len)
    }
  } catch (error) {
    console.warn('Audio ringtone playback failed:', error)
  }
}
