import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  linkWithPopup,
  onIdTokenChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, firebaseConfigured } from '@/lib/firebase'
import { subscribeProfile } from '@/services/users'

const AuthContext = createContext(null)

/**
 * Save this visitor's tickets to a Google account. Linking keeps the same uid, so existing
 * bookings move with it. If that Google account was already used here, switch to it instead;
 * tickets booked on this device stay listed through deviceTickets.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const current = auth.currentUser
  if (current?.isAnonymous) {
    try {
      const cred = await linkWithPopup(current, provider)
      await cred.user.reload()
      // Token must refresh so firestore.rules see the new sign-in provider.
      await cred.user.getIdToken(true)
      return cred.user
    } catch (err) {
      if (err.code !== 'auth/credential-already-in-use' && err.code !== 'auth/email-already-in-use') throw err
      const credential = GoogleAuthProvider.credentialFromError(err)
      if (credential) return (await signInWithCredential(auth, credential)).user
      return (await signInWithPopup(auth, provider)).user
    }
  }
  return (await signInWithPopup(auth, provider)).user
}

export function signOutVisitor() {
  return signOut(auth)
}

/**
 * Every visitor gets a Firebase user: anonymous for the public site (so bookings belong to
 * someone), email/password for staff. `role` comes from users/{uid}.
 */
export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [error, setError] = useState(null)
  // Linking Google keeps the same user object, so bump a counter to re-read its fields.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!firebaseConfigured) {
      setFbUser(null)
      return
    }
    return onIdTokenChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch((err) => {
          setError(err)
          setFbUser(null)
        })
        return
      }
      setFbUser(u)
      setVersion((v) => v + 1)
    })
  }, [])

  useEffect(() => {
    if (!fbUser || fbUser.isAnonymous) {
      setProfile(fbUser === undefined ? undefined : null)
      return
    }
    setProfile(undefined)
    return subscribeProfile(fbUser.uid, setProfile, () => setProfile(null))
  }, [fbUser?.uid, fbUser?.isAnonymous]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => {
    const role = profile?.role || (fbUser && !fbUser.isAnonymous ? 'none' : 'visitor')
    return {
      loading: fbUser === undefined || (fbUser && !fbUser.isAnonymous && profile === undefined),
      error,
      user: fbUser
        ? {
            uid: fbUser.uid,
            email: fbUser.email,
            isAnonymous: fbUser.isAnonymous,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            isGoogle: fbUser.providerData.some((p) => p.providerId === 'google.com'),
            role,
            profile,
          }
        : null,
      role,
      isStaff: role === 'admin' || role === 'organizer',
      isDoor: role === 'door',
      isAdmin: role === 'admin',
    }
  }, [fbUser, profile, error, version]) // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
