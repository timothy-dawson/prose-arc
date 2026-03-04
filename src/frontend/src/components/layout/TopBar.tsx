import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuSun, LuMoon } from 'react-icons/lu'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { queryClient } from '@/lib/queryClient'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useNotificationStream } from '@/hooks/useNotifications'

export function UserMenu() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { isDark, toggleTheme } = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    queryClient.clear()
    void navigate('/login')
  }

  const initials = user?.display_name
    ? user.display_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-1">
      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-gray-700 transition-colors"
      >
        {isDark ? <LuSun size={15} /> : <LuMoon size={15} />}
      </button>

      {/* User avatar / menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name ?? 'Avatar'}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {initials}
            </div>
          )}
          <span className="hidden text-sm text-gray-700 dark:text-gray-300 sm:block">
            {user?.display_name ?? user?.email}
          </span>
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
              <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2">
                <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function TopBar() {
  useNotificationStream()

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4">
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
