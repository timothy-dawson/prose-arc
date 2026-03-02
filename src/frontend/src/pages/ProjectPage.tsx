import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBinder, useProject } from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'
import { BinderTree } from '@/components/manuscript/BinderTree'
import { Editor } from '@/components/manuscript/Editor'
import { StatusBar } from '@/components/manuscript/StatusBar'
import { SearchPanel } from '@/components/manuscript/SearchPanel'
import { UserMenu } from '@/components/layout/TopBar'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const setCurrentProject = useEditorStore((s) => s.setCurrentProject)
  const currentNodeId = useEditorStore((s) => s.currentNodeId)
  const showSearch = useEditorStore((s) => s.showSearch)
  const toggleSearch = useEditorStore((s) => s.toggleSearch)

  const { data: project, isLoading: projectLoading } = useProject(projectId ?? null)
  const { data: nodes = [], isLoading: binderLoading } = useBinder(projectId ?? null)

  // Set active project in store when mounted / projectId changes
  useEffect(() => {
    if (projectId) setCurrentProject(projectId)
    return () => setCurrentProject(null)
  }, [projectId, setCurrentProject])

  // Ctrl+Shift+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        toggleSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!projectId) {
    navigate('/dashboard')
    return null
  }

  if (projectLoading || binderLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Project not found.{' '}
        <button className="ml-1 underline" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-800"
          title="Back to dashboard"
        >
          ← Dashboard
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-sm font-semibold text-gray-800 truncate">{project.title}</h1>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: binder tree (+ optional search panel below) */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 flex flex-col overflow-hidden">
          <div className={`${showSearch ? 'flex-1' : 'flex-1'} overflow-hidden flex flex-col`}>
            <BinderTree projectId={projectId} nodes={nodes} />
          </div>
          {showSearch && (
            <div className="h-64 flex-shrink-0 border-t border-gray-200 flex flex-col overflow-hidden">
              <SearchPanel projectId={projectId} onClose={toggleSearch} />
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentNodeId ? (
            <Editor projectId={projectId} nodeId={currentNodeId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a chapter or scene to start writing.
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar projectId={projectId} nodes={nodes} />
    </div>
  )
}
