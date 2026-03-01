import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

/**
 * Handles the redirect from the backend Google OAuth callback.
 *
 * The backend redirects here with:
 *   /auth/callback?access_token=...&refresh_token=...
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')

    if (accessToken && refreshToken) {
      setAuth({ accessToken, refreshToken })
      void navigate('/dashboard', { replace: true })
    } else {
      // Something went wrong with OAuth — redirect to login with error state
      void navigate('/login?error=oauth_failed', { replace: true })
    }
  }, [searchParams, setAuth, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-500">Completing sign-in…</p>
    </div>
  )
}
