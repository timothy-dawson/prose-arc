import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { AuthUser } from '@/stores/authStore'
import { useAuthStore } from '@/stores/authStore'

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)
  const setUser = useAuthStore((s) => s.setUser)

  return useQuery<AuthUser>({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<AuthUser>('/users/me')
      setUser(data)
      return data
    },
    enabled: isAuthenticated,
  })
}
