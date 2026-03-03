import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useRestoreProject,
} from '@/hooks/useManuscript'
import type { ProjectRead } from '@/api/manuscripts'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'

const EXPIRY_DAYS = 30

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function computeDaysLeft(deletedAt: string): number {
  return Math.max(
    0,
    EXPIRY_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000),
  )
}

function DaysBadge({ days }: { days: number }) {
  const color =
    days > 14
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
      : days > 7
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  return (
    <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
      {days}d until deletion
    </span>
  )
}

function ProjectCard({
  project,
  onDelete,
  onRestore,
}: {
  project: ProjectRead
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}) {
  const navigate = useNavigate()
  const isDeleted = !!project.deleted_at
  const days = isDeleted ? computeDaysLeft(project.deleted_at!) : null

  if (isDeleted) {
    return (
      <div className="relative flex flex-col gap-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-5 opacity-70">
        <div className="text-2xl grayscale">📖</div>
        <h3 className="font-semibold text-gray-400 dark:text-gray-600 truncate line-through">
          {project.title}
        </h3>
        <div className="text-xs text-gray-400 space-y-0.5">
          <p>{project.word_count.toLocaleString()} words</p>
          <p>Deleted {formatDate(project.deleted_at!)}</p>
        </div>
        {days !== null && <DaysBadge days={days} />}
        <button
          className="mt-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 self-start"
          onClick={() => onRestore(project.id)}
        >
          Restore
        </button>
      </div>
    )
  }

  return (
    <div
      className="group relative flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm cursor-pointer transition-all"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="text-2xl">📖</div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{project.title}</h3>
      <div className="text-xs text-gray-400 space-y-0.5">
        <p>{project.word_count.toLocaleString()} words</p>
        <p>Updated {formatDate(project.updated_at)}</p>
      </div>

      {/* Delete button — visible on hover */}
      <button
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-sm"
        title="Delete project"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(project.id)
        }}
      >
        ✕
      </button>
    </div>
  )
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const createProject = useCreateProject()

  const handleCreate = async () => {
    if (!title.trim()) return
    const project = await createProject.mutateAsync({ title: title.trim() })
    onClose()
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold mb-4 dark:text-gray-200">New Project</h2>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Project title"
          className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={handleCreate}
            disabled={!title.trim() || createProject.isPending}
          >
            {createProject.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: user } = useCurrentUser()
  const [showDeleted, setShowDeleted] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { data: projects = [], isLoading } = useProjects(showDeleted)
  const deleteProject = useDeleteProject()
  const restoreProject = useRestoreProject()
  const [showNewDialog, setShowNewDialog] = useState(false)

  const confirmDeleteProject = projects.find((p) => p.id === confirmDeleteId) ?? null

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {user?.display_name ? `Welcome back, ${user.display_name}` : 'Welcome back'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDeleted((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                showDeleted
                  ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {showDeleted ? 'Hide deleted' : 'Show deleted'}
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              onClick={() => setShowNewDialog(true)}
            >
              + New Project
            </button>
          </div>
        </div>

        {/* Project grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="text-4xl">📖</div>
            <h2 className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
              {showDeleted ? 'No deleted projects' : 'No projects yet'}
            </h2>
            {!showDeleted && (
              <>
                <p className="mt-2 text-sm text-gray-400">
                  Create your first project to get started.
                </p>
                <button
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  onClick={() => setShowNewDialog(true)}
                >
                  + New Project
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) => setConfirmDeleteId(id)}
                onRestore={(id) => restoreProject.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {showNewDialog && <NewProjectDialog onClose={() => setShowNewDialog(false)} />}

      <DeleteConfirmDialog
        open={!!confirmDeleteId}
        itemName={confirmDeleteProject?.title ?? ''}
        itemType="project"
        expiryDays={EXPIRY_DAYS}
        onConfirm={() => {
          if (confirmDeleteId) deleteProject.mutate(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
        isPending={deleteProject.isPending}
      />
    </div>
  )
}
