import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  // Wait for localStorage rehydration before deciding whether to redirect.
  // Without this, the initial render sees accessToken=null and bounces to /login.
  if (!hasHydrated) {
    return null
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
