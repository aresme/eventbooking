import { createContext, useContext } from 'react'

/**
 * The dashboard code is served as two separate pages:
 *   /admin      → admins only (admin.html)
 *   /organizer  → organizers and their door staff, plus organizer sign-up (organizer.html)
 */
export const PORTALS = {
  admin: { base: '/admin', title: 'Admin', roles: ['admin'] },
  organizer: { base: '/organizer', title: 'Organizer', roles: ['organizer', 'door'] },
}

export const PortalContext = createContext(PORTALS.admin)
export const usePortal = () => useContext(PortalContext)
