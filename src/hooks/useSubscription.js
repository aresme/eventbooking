import { useEffect, useState } from 'react'

/**
 * Run a Firestore `subscribe(onData, onError)` function and expose its latest value.
 * `deps` controls re-subscription; pass `enabled=false` to skip (e.g. while auth loads).
 */
export function useSubscription(subscribe, deps, { enabled = true, initial = undefined } = {}) {
  const [state, setState] = useState({ data: initial, loading: enabled, error: null })

  useEffect(() => {
    if (!enabled) {
      setState({ data: initial, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    const unsubscribe = subscribe(
      (data) => setState({ data, loading: false, error: null }),
      (error) => {
        console.error(error)
        setState({ data: initial, loading: false, error })
      },
    )
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled])

  return state
}
