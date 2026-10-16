import { useState } from 'react'
import { Clock, ShieldX } from 'lucide-react'
import { staffSignIn, organizerSignUp, staffSignOut } from '@/services/users'
import { Logo, ThemeToggle } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email.',
}

function Shell({ children }) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="hero-glow absolute inset-0 -z-10 opacity-60" />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">{children}</div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">← Back to events</a>
        </p>
      </div>
    </div>
  )
}

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [values, setValues] = useState({ email: '', password: '', displayName: '', org: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))
  const signup = mode === 'signup'

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (signup) {
        if (values.displayName.trim().length < 2) throw { code: 'name' }
        await organizerSignUp({ ...values, email: values.email.trim(), displayName: values.displayName.trim(), org: values.org.trim() })
      } else {
        await staffSignIn(values.email.trim(), values.password)
      }
    } catch (err) {
      setError(err.code === 'name' ? 'Enter your name.' : AUTH_ERRORS[err.code] || err.message)
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="text-xl font-extrabold">{signup ? 'Become an organizer' : 'Organizer sign in'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {signup ? 'Run events for your club or school. An admin will approve your account.' : 'Manage events, bookings and check-in.'}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {signup && (
          <>
            <Field label="Your name">{(p) => <Input {...p} value={values.displayName} onChange={set('displayName')} autoComplete="name" required />}</Field>
            <Field label="Club / organization" optional>{(p) => <Input {...p} value={values.org} onChange={set('org')} placeholder="e.g. Computing Society" />}</Field>
          </>
        )}
        <Field label="Email">{(p) => <Input {...p} type="email" value={values.email} onChange={set('email')} autoComplete="email" required />}</Field>
        <Field label="Password" hint={signup ? 'At least 6 characters' : undefined}>
          {(p) => <Input {...p} type="password" value={values.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={6} />}
        </Field>
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          {signup ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {signup ? 'Already have an account?' : 'Want to host events?'}{' '}
        <button onClick={() => { setMode(signup ? 'signin' : 'signup'); setError('') }} className="font-semibold text-primary hover:underline">
          {signup ? 'Sign in' : 'Apply as organizer'}
        </button>
      </p>
    </Shell>
  )
}

export function PendingApproval({ role }) {
  const pending = role === 'pending'
  return (
    <Shell>
      <div className="text-center">
        <div className={`mx-auto mb-4 grid size-12 place-items-center rounded-full ${pending ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'}`}>
          {pending ? <Clock className="size-5" /> : <ShieldX className="size-5" />}
        </div>
        <h1 className="text-xl font-extrabold">{pending ? 'Waiting for approval' : 'No dashboard access'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pending
            ? 'Your organizer account was created. An admin needs to approve it before you can create events. This page updates automatically.'
            : 'This account isn’t an organizer or admin.'}
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={staffSignOut}>Sign out</Button>
      </div>
    </Shell>
  )
}
