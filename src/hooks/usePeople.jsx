import { createContext, useCallback, useContext, useMemo } from 'react'
import { toast } from 'sonner'
import { useAuth } from './useAuth'
import { useSubscription } from './useSubscription'
import { setFollowing, setSaved, subscribePerson } from '@/services/people'

const PeopleContext = createContext({ saved: [], following: [], toggleSave() {}, toggleFollow() {} })

/** The visitor's saved events and followed clubs (people/{uid}), shared by the whole public site. */
export function PeopleProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid
  const { data } = useSubscription((ok, err) => subscribePerson(uid, ok, err), [uid], { enabled: Boolean(uid), initial: { saved: [], following: [] } })

  const toggleSave = useCallback(
    async (eventId) => {
      if (!uid) return
      const on = !data.saved.includes(eventId)
      try {
        await setSaved(uid, eventId, on)
        toast.success(on ? 'Saved. Find it under My tickets.' : 'Removed from saved')
      } catch {
        toast.error('Couldn’t update saved events')
      }
    },
    [uid, data.saved],
  )

  const toggleFollow = useCallback(
    async (clubId, name) => {
      if (!uid) return
      const on = !data.following.includes(clubId)
      try {
        await setFollowing(uid, clubId, on)
        toast.success(on ? `Following ${name || 'this club'}. Their events show first on the home page.` : `Unfollowed ${name || 'club'}`)
      } catch {
        toast.error('Couldn’t update following')
      }
    },
    [uid, data.following],
  )

  const value = useMemo(() => ({ saved: data.saved, following: data.following, toggleSave, toggleFollow }), [data, toggleSave, toggleFollow])
  return <PeopleContext.Provider value={value}>{children}</PeopleContext.Provider>
}

export const usePeople = () => useContext(PeopleContext)
