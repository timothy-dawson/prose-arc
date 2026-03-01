import { useCurrentUser } from '@/hooks/useCurrentUser'

export function DashboardPage() {
  const { data: user } = useCurrentUser()

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.display_name ? `Welcome back, ${user.display_name}` : 'Welcome back'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{user?.email}</p>

        <div className="mt-8 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-4xl">📖</div>
          <h2 className="mt-4 text-lg font-semibold text-gray-700">Your Projects</h2>
          <p className="mt-2 text-sm text-gray-400">
            Project management is coming in Phase 1b. Check back soon!
          </p>
        </div>
      </div>
    </div>
  )
}
