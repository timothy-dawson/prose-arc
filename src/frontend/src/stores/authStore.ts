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
  setAuth: (auth: { user?: AuthUser; accessToken: string; refreshToken: string }) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set((state) => ({
          user: user ?? state.user,
          accessToken,
          refreshToken,
        })),

      setUser: (user) => set({ user }),

      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),

      get isAuthenticated() {
        return !!get().accessToken
      },
    }),
    {
      name: 'prose-arc-auth',
      // Only persist the token fields — not derived values
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
)
