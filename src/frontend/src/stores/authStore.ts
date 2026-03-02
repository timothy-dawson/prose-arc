/**
 * Zustand auth store — persisted to localStorage.
 *
 * Holds the authenticated user, access token, and refresh token.
 * The API client reads from this store to attach auth headers.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  is_verified: boolean
  created_at: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  /** True once the persist middleware has rehydrated from localStorage. */
  _hasHydrated: boolean
  setAuth: (auth: { user?: AuthUser; accessToken: string; refreshToken: string }) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set((state) => ({
          user: user ?? state.user,
          accessToken,
          refreshToken,
        })),

      setUser: (user) => set({ user }),

      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'prose-arc-auth',
      // Only persist the token fields — not derived values or the hydration flag
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)

// Zustand's persist middleware hydrates asynchronously (multiple Promise hops)
// even for synchronous storage like localStorage. Set _hasHydrated once done so
// ProtectedRoute doesn't redirect before the stored tokens are merged into state.
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ _hasHydrated: true })
} else {
  useAuthStore.persist.onFinishHydration(() => {
    useAuthStore.setState({ _hasHydrated: true })
  })
}
