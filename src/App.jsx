import { lazy, Suspense, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import './App.css'

const ChatApp = lazy(() => import('./ChatApp'))

function getAuthErrorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email and password combination does not match.'
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Try signing in instead.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/invalid-api-key':
      return 'Firebase rejected this app’s API key. Check that the Firebase configuration matches the project.'
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not configured for this project. Enable it in the Firebase Console.'
    case 'auth/admin-restricted-operation':
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before you signed in.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Connection problem. Check your internet and try again.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.'
    case 'auth/unauthorized-domain':
      return 'This site is not authorized for Firebase Authentication. Add its hostname under Authentication → Settings → Authorized domains.'
    default:
      return error.code
        ? `Firebase Authentication returned ${error.code}. Check the request’s Response in your browser’s Network tab for details.`
        : 'Something went wrong. Please try again.'
  }
}

function ChatMark({ small = false }) {
  return (
    <span className={`chat-mark${small ? ' chat-mark--small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M7.25 8.5A3.75 3.75 0 0 1 11 4.75h10A3.75 3.75 0 0 1 24.75 8.5v7A3.75 3.75 0 0 1 21 19.25h-4.9l-5.3 4v-4h-.8a3.75 3.75 0 0 1-3.75-3.75v-7Z"
          fill="currentColor"
        />
        <path
          d="M11 12h10M11 15.5h6"
          stroke="white"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="google-mark">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.798 2.715v2.258h2.91c1.702-1.566 2.684-3.874 2.684-6.613Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.182l-2.91-2.258c-.806.54-1.837.86-3.046.86-2.34 0-4.325-1.58-5.034-3.71H.958v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.966 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.958a9 9 0 0 0 0 8.08l3.008-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.322 0 2.508.454 3.442 1.346l2.582-2.582C13.462.892 11.426 0 9 0A9 9 0 0 0 .958 4.96l3.008 2.33C4.675 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [mode, setMode] = useState('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isSignUp = mode === 'sign-up'

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser)
    setAuthLoading(false)
  }), [])

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)

    try {
      if (isSignUp) {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() })
        }
        setUser(credential.user)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    setNotice('')
    setBusy(true)

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (authError) {
      setError(getAuthErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordReset() {
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError('Enter your email address first, and we’ll send you a reset link.')
      return
    }

    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice('Password reset link sent. Check your inbox.')
    } catch (authError) {
      setError(getAuthErrorMessage(authError))
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    return (
      <Suspense fallback={<main className="app-startup" role="status"><span className="spinner" /></main>}>
        <ChatApp user={user} />
      </Suspense>
    )
  }

  return (
    <main className="auth-page">
      <aside className="welcome-panel">
        <div className="welcome-content">
          <a className="brand brand--light" href="/" aria-label="Chatter home">
            <ChatMark />
            <span>chatter</span>
          </a>

          <div className="welcome-copy">
            <span className="eyebrow">A little closer, every day</span>
            <h1>Good conversations start here.</h1>
            <p>
              Catch up, share a moment, or just say hello. Your people are only a
              message away.
            </p>
          </div>

          <div className="conversation-card" aria-hidden="true">
            <div className="conversation-topline">
              <span className="online-dot" />
              <span>Your conversations</span>
              <span className="conversation-menu">•••</span>
            </div>
            <div className="conversation-person">
              <div className="avatar avatar--peach">M</div>
              <div className="person-info">
                <strong>Maya Chen</strong>
                <span>That sounds like a plan! ✨</span>
              </div>
              <time>now</time>
            </div>
            <div className="conversation-person">
              <div className="avatar avatar--blue">J</div>
              <div className="person-info">
                <strong>Jordan Lee</strong>
                <span>Sent you a photo</span>
              </div>
              <time>2m</time>
            </div>
            <div className="message-bubble">Are we still on for coffee? ☕</div>
            <div className="message-bubble message-bubble--reply">
              Wouldn’t miss it!
              <span className="message-check">✓✓</span>
            </div>
          </div>

          <div className="welcome-footer">
            <span className="footer-avatars" aria-hidden="true">
              <span>M</span><span>J</span><span>A</span><span>+</span>
            </span>
            <span>Good things happen when we connect.</span>
          </div>
        </div>
        <div className="panel-orb panel-orb--one" />
        <div className="panel-orb panel-orb--two" />
      </aside>

      <section className="form-panel">
        <a className="brand brand--mobile" href="/" aria-label="Chatter home">
          <ChatMark small />
          <span>chatter</span>
        </a>

        <div className="auth-card">
          {authLoading ? (
            <div className="loading-state" role="status" aria-label="Loading account">
              <span className="spinner" />
            </div>
          ) : (
            <>
              <div className="form-heading">
                <span className="eyebrow">{isSignUp ? 'A seat at the table' : 'Your people are here'}</span>
                <h2>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
                <p className="auth-description">
                  {isSignUp
                    ? 'A few details and you’re ready to connect.'
                    : 'Sign in to pick up right where you left off.'}
                </p>
              </div>

              <button
                className="google-button"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
              >
                <GoogleMark />
                Continue with Google
              </button>

              <div className="divider"><span>or continue with email</span></div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {isSignUp && (
                  <label className="field">
                    <span>Your name</span>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="What should we call you?"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </label>
                )}
                <label className="field">
                  <span>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'}
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>

                {!isSignUp && (
                  <button
                    className="text-button forgot-button"
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={busy}
                  >
                    Forgot password?
                  </button>
                )}

                {error && <p className="form-message form-message--error" role="alert">{error}</p>}
                {notice && <p className="form-message form-message--success" role="status">{notice}</p>}

                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
                  {!busy && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <p className="switch-mode">
                {isSignUp ? 'Already have an account?' : 'New around here?'}{' '}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => changeMode(isSignUp ? 'sign-in' : 'sign-up')}
                >
                  {isSignUp ? 'Sign in' : 'Create an account'}
                </button>
              </p>

              <p className="terms">
                By continuing, you agree to our <a href="#terms">Terms</a> and{' '}
                <a href="#privacy">Privacy Policy</a>.
              </p>
            </>
          )}
        </div>

        <p className="panel-note"><ChatMark small /> A little more connected.</p>
      </section>
    </main>
  )
}

export default App
