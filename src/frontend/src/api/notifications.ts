import apiClient from './client'

export type NotificationType = 'export_complete' | 'export_failed' | 'system' | 'billing'

export interface NotificationRead {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

export interface NotificationPreference {
  id: string
  user_id: string
  type: string
  enabled: boolean
}

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number; offset?: number }) =>
    apiClient.get<NotificationRead[]>('/notifications', { params }).then((r) => r.data),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then(() => undefined),

  markAllRead: () =>
    apiClient.post('/notifications/mark-all-read').then(() => undefined),

  getPreferences: () =>
    apiClient.get<NotificationPreference[]>('/notifications/preferences').then((r) => r.data),

  updatePreference: (type: string, enabled: boolean) =>
    apiClient
      .patch<NotificationPreference>('/notifications/preferences', { type, enabled })
      .then((r) => r.data),
}
