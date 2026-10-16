import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/useAuth'
import { firebaseConfigured } from '@/lib/firebase'
import { ConfirmProvider } from '@/components/ui/dialog'

/** Providers shared by the public site (index.html) and the admin page (admin.html). */
export function AppShell({ children }) {
  if (!firebaseConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <ConfirmProvider>
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
      </ConfirmProvider>
    </AuthProvider>
  )
}

function SetupNotice() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 shadow-card">
        <h1 className="text-xl font-extrabold">Firebase isn’t configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code>, fill in your Firebase web app keys, then restart <code className="rounded bg-muted px-1">npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
