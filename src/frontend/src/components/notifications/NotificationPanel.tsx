import { useEffect, useRef } from 'react'
import { LuBellOff, LuCheck, LuDownload, LuLoader, LuX } from 'react-icons/lu'
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/useNotifications'
import type { NotificationRead } from '@/api/notifications'

interface NotificationPanelProps {
  onClose: () => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'export_complete':
      return <LuDownload size={14} className="text-green-500" />
    case 'export_failed':
      return <LuX size={14} className="text-red-500" />
    default:
      return <LuBellOff size={14} className="text-gray-400" />
  }
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  // Close when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleNotificationClick = (n: NotificationRead) => {
    if (!n.read) {
      markRead.mutate(n.id)
    }
    // Navigate to relevant content if data has a reference
    const data = n.data as Record<string, string>
    if (n.type === 'export_complete' && data?.job_id) {
      // Could navigate to export history — for now just close
    }
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</span>
        <button
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || notifications.every((n) => n.read)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-6">
            <LuLoader size={18} className="animate-spin text-gray-400" />
          </div>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="py-8 text-center">
            <LuCheck size={24} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">You're all caught up</p>
          </div>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => handleNotificationClick(n)}
            className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${
              !n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              <NotificationIcon type={n.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${!n.read ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                {n.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.read && (
              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
