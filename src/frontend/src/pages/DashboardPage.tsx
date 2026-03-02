import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/useManuscript'
import type { ProjectRead } from '@/api/manuscripts'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectRead
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className="group relative flex flex-col gap-2 rounded-lg border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="text-2xl">📖</div>
      <h3 className="font-semibold text-gray-900 truncate">{project.title}</h3>
      <div className="text-xs text-gray-400 space-y-0.5">
        <p>{project.word_count.toLocaleString()} words</p>
        <p>Updated {formatDate(project.updated_at)}</p>
      </div>

      {/* Delete button — visible on hover */}
      {!confirmDelete ? (
        <button
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-sm"
          title="Delete project"
          onClick={(e) => {
            e.stopPropagation()
            setConfirmDelete(true)
          }}
        >
          ✕
        </button>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/95 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-medium text-gray-700">Delete "{project.title}"?</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              onClick={() => onDelete(project.id)}
            >
              Delete
            </button>
            <button
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold mb-4">New Project</h2>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Project title"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
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
  const { data: projects = [], isLoading } = useProjects()
  const deleteProject = useDeleteProject()
  const [showNewDialog, setShowNewDialog] = useState(false)

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.display_name ? `Welcome back, ${user.display_name}` : 'Welcome back'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            onClick={() => setShowNewDialog(true)}
          >
            + New Project
          </button>
        </div>

        {/* Project grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg border border-gray-200 bg-gray-50 animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="text-4xl">📖</div>
            <h2 className="mt-4 text-lg font-semibold text-gray-700">No projects yet</h2>
            <p className="mt-2 text-sm text-gray-400">
              Create your first project to get started.
            </p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              onClick={() => setShowNewDialog(true)}
            >
              + New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) => deleteProject.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {showNewDialog && <NewProjectDialog onClose={() => setShowNewDialog(false)} />}
    </div>
  )
}
