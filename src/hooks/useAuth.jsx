import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth, firebaseConfigured } from '@/lib/firebase'
import { subscribeProfile } from '@/services/users'

const AuthContext = createContext(null)

/**
 * Every visitor gets a Firebase user: anonymous for the public site (so bookings belong to
 * someone), email/password for staff. `role` comes from users/{uid}.
 */
export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!firebaseConfigured) {
      setFbUser(null)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch((err) => {
          setError(err)
          setFbUser(null)
        })
        return
      }
      setFbUser(u)
    })
  }, [])

  useEffect(() => {
    if (!fbUser || fbUser.isAnonymous) {
      setProfile(fbUser === undefined ? undefined : null)
      return
    }
    setProfile(undefined)
    return subscribeProfile(fbUser.uid, setProfile, () => setProfile(null))
  }, [fbUser])

  const value = useMemo(() => {
    const role = profile?.role || (fbUser && !fbUser.isAnonymous ? 'none' : 'visitor')
    return {
      loading: fbUser === undefined || (fbUser && !fbUser.isAnonymous && profile === undefined),
      error,
      user: fbUser
        ? { uid: fbUser.uid, email: fbUser.email, isAnonymous: fbUser.isAnonymous, role, profile }
        : null,
      role,
      isStaff: role === 'admin' || role === 'organizer',
      isAdmin: role === 'admin',
    }
  }, [fbUser, profile, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
