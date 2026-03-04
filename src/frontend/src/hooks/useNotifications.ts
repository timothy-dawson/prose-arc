import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { notificationsApi } from '@/api/notifications'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8100'

export function useNotifications(options?: { unreadOnly?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['notifications', options],
    queryFn: () =>
      notificationsApi.list({
        unread_only: options?.unreadOnly,
        limit: options?.limit ?? 50,
      }),
    staleTime: 30_000,
  })
}

export function useUnreadCount() {
  return useNotificationStore((s) => s.unreadCount)
}

export function useMarkRead() {
  const qc = useQueryClient()
  const decrementUnread = useNotificationStore((s) => s.decrementUnread)
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      decrementUnread()
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      setUnreadCount(0)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/**
 * Connects to the SSE stream and keeps the unread badge up-to-date.
 * Call once from a top-level component (TopBar) when the user is authenticated.
 */
export function useNotificationStream() {
  const token = useAuthStore((s) => s.accessToken)
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const qc = useQueryClient()

  useEffect(() => {
    if (!token) return

    let controller: AbortController | null = new AbortController()

    const connect = async () => {
      try {
        const { fetchEventSource } = await import('@microsoft/fetch-event-source')
        await fetchEventSource(`${API_URL}/api/v1/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller?.signal,
          openWhenHidden: true,
          onmessage(ev) {
            try {
              const data = JSON.parse(ev.data)
              if (typeof data.unread_count === 'number') {
                setUnreadCount(data.unread_count)
              }
              if (ev.event === 'notification' && data.notification) {
                const n = data.notification
                qc.invalidateQueries({ queryKey: ['notifications'] })
                if (n.type === 'export_complete') {
                  toast.success(n.title, { description: n.message })
                } else if (n.type === 'export_failed') {
                  toast.error(n.title, { description: n.message })
                }
              }
            } catch {
              // non-JSON message; ignore
            }
          },
          onerror(err) {
            // fetchEventSource retries automatically; log and continue
            console.warn('[SSE] Connection error, retrying…', err)
          },
        })
      } catch {
        // AbortError on unmount — expected, ignore
      }
    }

    connect()

    return () => {
      controller?.abort()
      controller = null
    }
  }, [token, setUnreadCount, qc])
}
