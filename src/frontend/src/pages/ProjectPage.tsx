import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LuBookOpen, LuBook, LuPenLine, LuLayoutDashboard } from 'react-icons/lu'
import { useBinder, useProject } from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'
import { BinderTree } from '@/components/manuscript/BinderTree'
import { Editor } from '@/components/manuscript/Editor'
import { FolderView } from '@/components/manuscript/FolderView'
import { ScriveningsView } from '@/components/manuscript/ScriveningsView'
import { StatusBar } from '@/components/manuscript/StatusBar'
import { SearchPanel } from '@/components/manuscript/SearchPanel'
import { KanbanBoard } from '@/components/manuscript/KanbanBoard'
import { CodexPanel } from '@/components/codex/CodexPanel'
import { CodexEntryDetail } from '@/components/codex/CodexEntryDetail'
import { UserMenu } from '@/components/layout/TopBar'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const setCurrentProject = useEditorStore((s) => s.setCurrentProject)
  const setCurrentNode = useEditorStore((s) => s.setCurrentNode)
  const currentNodeId = useEditorStore((s) => s.currentNodeId)
  const showSearch = useEditorStore((s) => s.showSearch)
  const toggleSearch = useEditorStore((s) => s.toggleSearch)
  const sidebarTab = useEditorStore((s) => s.sidebarTab)
  const setSidebarTab = useEditorStore((s) => s.setSidebarTab)
  const activeCodexEntryId = useEditorStore((s) => s.activeCodexEntryId)
  const showKanban = useEditorStore((s) => s.showKanban)
  const toggleKanban = useEditorStore((s) => s.toggleKanban)

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
      <div className="flex items-center justify-center h-screen text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 text-sm">
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 text-sm">
        Project not found.{' '}
        <button className="ml-1 underline" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </button>
      </div>
    )
  }

  const currentNode = nodes.find((n) => n.id === currentNodeId) ?? null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex-shrink-0"
            title="Back to dashboard"
          >
            ← Dashboard
          </button>
          <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">|</span>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{project.title}</h1>
        </div>

        {/* Center: view toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => showKanban && toggleKanban()}
            title="Editor view"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              !showKanban
                ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <LuPenLine size={13} />
            Editor
          </button>
          <button
            onClick={() => !showKanban && toggleKanban()}
            title="Kanban view"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              showKanban
                ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <LuLayoutDashboard size={13} />
            Kanban
          </button>
        </div>

        {/* Right: user menu */}
        <div className="flex-1 flex justify-end">
          <UserMenu />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Sidebar tab bar */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
            <button
              onClick={() => setSidebarTab('binder')}
              className={`flex-1 py-2 text-xs font-medium flex flex-col items-center gap-0.5 border-b-2 transition-colors ${
                sidebarTab === 'binder'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LuBookOpen size={13} />
              Binder
            </button>
            <button
              onClick={() => setSidebarTab('codex')}
              className={`flex-1 py-2 text-xs font-medium flex flex-col items-center gap-0.5 border-b-2 transition-colors ${
                sidebarTab === 'codex'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LuBook size={13} />
              Codex
            </button>
          </div>

          {/* Sidebar content */}
          {sidebarTab === 'binder' ? (
            <>
              <div className="flex-1 overflow-hidden flex flex-col">
                <BinderTree projectId={projectId} nodes={nodes} />
              </div>
              {showSearch && (
                <div className="h-64 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                  <SearchPanel projectId={projectId} onClose={toggleSearch} />
                </div>
              )}
            </>
          ) : activeCodexEntryId ? (
            <div className="flex-1 overflow-hidden">
              <CodexEntryDetail projectId={projectId} entryId={activeCodexEntryId} />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <CodexPanel projectId={projectId} />
            </div>
          )}
        </div>

        {/* Main content: kanban or node-type-aware view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showKanban ? (
            <KanbanBoard projectId={projectId} nodes={nodes} />
          ) : !currentNode ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              Select a chapter or scene to start writing.
            </div>
          ) : currentNode.node_type === 'folder' ? (
            <FolderView
              projectId={projectId}
              node={currentNode}
              allNodes={nodes}
              onSelect={setCurrentNode}
            />
          ) : currentNode.node_type === 'chapter' &&
            nodes.some((n) => n.parent_id === currentNode.id && n.node_type === 'scene') ? (
            <ScriveningsView
              projectId={projectId}
              node={currentNode}
              scenes={nodes.filter((n) => n.parent_id === currentNode.id && n.node_type === 'scene')}
              onEditScene={setCurrentNode}
            />
          ) : (
            <Editor projectId={projectId} nodeId={currentNode.id} node={currentNode} />
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar projectId={projectId} nodes={nodes} />
    </div>
  )
}
