import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * The admin and organizer areas are separate pages. If the public app is ever rendered at an
 * /admin or /organizer URL, a stale service worker from an older version served it from cache. Remove the
 * old worker and caches, then load the real admin page from the network.
 */
export default function AdminRedirect() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const target = window.location.pathname.replace(/^\/dashboard/, '/organizer') + window.location.search
    const key = 'uv_admin_redirect'
    let tried = false
    try {
      tried = sessionStorage.getItem(key) === '1'
      sessionStorage.setItem(key, '1')
    } catch {
      /* private mode */
    }
    if (tried) {
      setFailed(true)
      return
    }
    ;(async () => {
      try {
        const regs = (await navigator.serviceWorker?.getRegistrations()) || []
        await Promise.all(regs.map((r) => r.unregister()))
        if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
      } catch {
        /* ignore */
      }
      window.location.replace(target)
    })()
  }, [])

  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      {failed ? (
        <div>
          <p className="font-bold">Couldn’t open that page.</p>
          <p className="mt-1 text-sm text-muted-foreground">Clear this site’s data in your browser settings, then try again.</p>
          <a href={window.location.pathname} className="mt-4 inline-block font-semibold text-primary hover:underline">Try again</a>
        </div>
      ) : (
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Opening admin page" />
      )}
    </div>
  )
}
