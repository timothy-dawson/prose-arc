export function PageSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
        <span className="text-sm text-gray-400 dark:text-gray-500">Loading…</span>
      </div>
    </div>
  )
}
