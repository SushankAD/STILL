import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { isAuthImplicitGrantRedirectError } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import StillApp from './App'
import { getProfile, updateProfileName } from './lib/profile-api'
import type { Profile } from './lib/profile-api'
import { isSupabaseConfigured, requireSupabase } from './lib/supabase'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password'
type AuthScreenMode = AuthMode | 'reset-password'

const accountActions = {
  'sign-in': { title: 'Welcome back.', copy: 'Sign in to keep your STILL profile with you.', submit: 'Sign in to STILL' },
  'sign-up': { title: 'Begin gently.', copy: 'Create an account to keep your STILL profile with you.', submit: 'Create my account' },
  'forgot-password': { title: 'Reset your password.', copy: 'Enter your account email to get a reset link.', submit: 'Send reset link' },
  'reset-password': { title: 'Choose a new password.', copy: 'Use at least 8 characters.', submit: 'Save new password' },
} satisfies Record<AuthScreenMode, { title: string; copy: string; submit: string }>

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="shell" aria-label="STILL">
      <section className="phone-wrap">
        <div className="phone auth-phone">
          <header className="topbar">
            <div />
            <div><strong>STILL</strong></div>
            <div />
          </header>
          <div className="screen auth-screen" role="status">{message}</div>
        </div>
      </section>
    </main>
  )
}

function AuthScreen({
  mode,
  onModeChange,
  onSubmit,
  busy,
  error,
  notice,
}: {
  mode: AuthScreenMode
  onModeChange: (mode: AuthMode) => void
  onSubmit: (values: { email: string; password: string; displayName: string }) => void
  busy: boolean
  error: string
  notice: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const action = accountActions[mode]
  const showAccountSwitch = mode === 'sign-in' || mode === 'sign-up'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit({ email: email.trim(), password, displayName: displayName.trim() })
  }

  return (
    <main className="shell" aria-label="STILL account">
      <section className="phone-wrap">
        <div className="phone auth-phone">
          <header className="topbar">
            <div />
            <div><p className="tiny-label">A quieter way forward</p><strong>STILL</strong></div>
            <div />
          </header>
          <div className="screen auth-screen">
            <div className="onboarding auth-onboarding">
              <div className="app-mark"><img className="brand-mark-img" src="/assets/still-app-icon.png" alt="" /></div>
              <p className="eyebrow">YOUR SPACE, YOUR PACE</p>
              <h1>{action.title}</h1>
              <p className="onboard-copy">{action.copy}</p>
            </div>

            {showAccountSwitch && <div className="auth-mode-switch" aria-label="Account action">
              <button
                type="button"
                className={mode === 'sign-in' ? 'selected' : ''}
                aria-pressed={mode === 'sign-in'}
                disabled={busy}
                onClick={() => onModeChange('sign-in')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === 'sign-up' ? 'selected' : ''}
                aria-pressed={mode === 'sign-up'}
                disabled={busy}
                onClick={() => onModeChange('sign-up')}
              >
                Create account
              </button>
            </div>}

            <form className="auth-form" onSubmit={submit}>
              {mode === 'sign-up' && (
                <label className="auth-field">
                  <span>Your name</span>
                  <input
                    className="input"
                    autoComplete="name"
                    maxLength={24}
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="What should STILL call you?"
                  />
                </label>
              )}
              {mode !== 'reset-password' && <label className="auth-field">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>}
              {mode !== 'forgot-password' && <label className="auth-field">
                <span>{mode === 'reset-password' ? 'New password' : 'Password'}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'reset-password' ? undefined : 'At least 8 characters'}
                />
              </label>}

              {error && <p className="auth-message error" role="alert">{error}</p>}
              {notice && <p className="auth-message" role="status">{notice}</p>}

              <button className="primary-btn" type="submit" disabled={busy} style={{ marginTop: 16 }}>
                {busy ? 'Please wait…' : action.submit}
              </button>
              {mode === 'sign-in' && <button className="ghost-btn" type="button" disabled={busy}
                onClick={() => onModeChange('forgot-password')}>Forgot password?</button>}
              {mode === 'forgot-password' && <button className="ghost-btn" type="button" disabled={busy}
                onClick={() => onModeChange('sign-in')}>Back to sign in</button>}
            </form>

            <p className="auth-privacy">Your private check-ins and progress belong to your account.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(isSupabaseConfigured)
  const [profileRetry, setProfileRetry] = useState(0)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const client = requireSupabase()
    let active = true
    let activeUserId: string | undefined
    function receiveSession(nextSession: Session | null) {
      if (!active) return
      setSession(nextSession)
      const nextUserId = nextSession?.user.id
      if (nextUserId === activeUserId) return

      activeUserId = nextUserId
      setProfile(null)
      setProfileError('')
      setAuthError('')
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      receiveSession(nextSession)
      const nextUserId = nextSession?.user.id
      if (event === 'PASSWORD_RECOVERY' && nextUserId) {
        setRecoveryUserId(nextUserId)
        setAuthError('')
        setNotice('')
      } else {
        setRecoveryUserId((userId) => userId === nextUserId ? userId : null)
      }
    })

    client.auth.initialize()
      .then(({ error }) => {
        if (active && isAuthImplicitGrantRedirectError(error)) {
          setAuthError('This email link is invalid or has expired. Request a new link to try again.')
          const url = new URL(window.location.href)
          url.hash = ''
          for (const param of ['error', 'error_code', 'error_description']) url.searchParams.delete(param)
          window.history.replaceState(window.history.state, '', url)
        }
        return client.auth.getSession()
      })
      .then(({ data, error }) => {
        if (error) throw error
        receiveSession(data.session)
      })
      .catch((error: unknown) => {
        if (active) setAuthError(errorMessage(error))
      })
      .finally(() => {
        if (active) setInitializing(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id
  const recoveringPassword = Boolean(userId && userId === recoveryUserId)

  useEffect(() => {
    if (!userId || recoveringPassword) return

    let active = true
    getProfile(userId)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile)
      })
      .catch((error: unknown) => {
        if (active) setProfileError(errorMessage(error))
      })

    return () => {
      active = false
    }
  }, [userId, profileRetry, recoveringPassword])

  const submitAuth = async (values: { email: string; password: string; displayName: string }) => {
    setBusy(true)
    setAuthError('')
    setNotice('')
    try {
      const client = requireSupabase()
      if (recoveringPassword) {
        const { error } = await client.auth.updateUser({ password: values.password })
        if (error) throw error
        setRecoveryUserId(null)
        setAuthMode('sign-in')
      } else if (authMode === 'forgot-password') {
        const { error } = await client.auth.resetPasswordForEmail(values.email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice('If an account uses that email, a reset link is on its way.')
      } else if (authMode === 'sign-up') {
        const { data, error } = await client.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { display_name: values.displayName },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Account created. Check your email to confirm it, then sign in.')
        } else {
          setNotice('Account created. Your private profile is ready.')
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })
        if (error) throw error
      }
    } catch (error: unknown) {
      setAuthError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
  }

  if (!isSupabaseConfigured) {
    return <StillApp demoMode />
  }

  if (initializing || (!recoveringPassword && session && !profile && !profileError)) {
    return <LoadingScreen message="Loading your private STILL space…" />
  }

  if (!recoveringPassword && session && profileError) {
    return (
      <LoadingScreenWithError
        message={profileError}
        onRetry={() => {
          setProfileError('')
          setProfileRetry((attempt) => attempt + 1)
        }}
        onSignOut={() => { void signOut().catch((error: unknown) => setAuthError(errorMessage(error))) }}
        signOutError={authError}
      />
    )
  }

  if (!recoveringPassword && session && profile) {
    return (
      <StillApp
        key={session.user.id}
        userId={session.user.id}
        accountCreatedAt={session.user.created_at}
        profileName={profile.display_name}
        onSaveProfileName={(name) => updateProfileName(session.user.id, name)}
        onSignOut={signOut}
      />
    )
  }

  return (
    <AuthScreen
      key={recoveringPassword ? 'recovery' : 'auth'}
      mode={recoveringPassword ? 'reset-password' : authMode}
      onModeChange={(mode) => {
        setAuthMode(mode)
        setAuthError('')
        setNotice('')
      }}
      onSubmit={(values) => { void submitAuth(values) }}
      busy={busy || initializing}
      error={authError}
      notice={notice}
    />
  )
}

function LoadingScreenWithError({
  message,
  onRetry,
  onSignOut,
  signOutError,
}: {
  message: string
  onRetry: () => void
  onSignOut: () => void
  signOutError: string
}) {
  return (
    <main className="shell" aria-label="STILL">
      <section className="phone-wrap">
        <div className="phone auth-phone">
          <header className="topbar">
            <div />
            <div><strong>STILL</strong></div>
            <div />
          </header>
          <div className="screen auth-screen">
            <p className="auth-message error" role="alert">{message}</p>
            {signOutError && <p className="auth-message error" role="alert">{signOutError}</p>}
            <button className="primary-btn" onClick={onRetry}>Retry loading profile</button>
            <button className="ghost-btn" style={{ width: '100%', marginTop: 10 }} onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </section>
    </main>
  )
}
