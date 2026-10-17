import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminApp from './AdminApp'
import '@/index.css'

try {
  sessionStorage.removeItem('uv_admin_redirect')
} catch {
  /* private mode */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminApp portal="admin" />
  </StrictMode>,
)
