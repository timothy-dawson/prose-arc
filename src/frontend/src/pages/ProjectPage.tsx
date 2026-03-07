import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LuBookOpen, LuBook, LuPenLine, LuLayoutDashboard, LuClock, LuTarget, LuX, LuDownload, LuMaximize } from 'react-icons/lu'
import { useBinder, useProject } from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'
import { useFocusThemeStore, type FocusTheme } from '@/stores/focusThemeStore'
import { BinderTree } from '@/components/manuscript/BinderTree'
import { Editor } from '@/components/manuscript/Editor'
import { FolderView } from '@/components/manuscript/FolderView'
import { ScriveningsView } from '@/components/manuscript/ScriveningsView'
import { StatusBar } from '@/components/manuscript/StatusBar'
import { SearchPanel } from '@/components/manuscript/SearchPanel'
import { KanbanBoard } from '@/components/manuscript/KanbanBoard'
import { CodexPanel } from '@/components/codex/CodexPanel'
import { CodexEntryDetail } from '@/components/codex/CodexEntryDetail'
import { VersionHistoryPanel } from '@/components/manuscript/VersionHistoryPanel'
import { GoalsPanel } from '@/components/manuscript/GoalsPanel'
import { UserMenu } from '@/components/layout/TopBar'
import { ExportDialog } from '@/components/export/ExportDialog'
import { KeyboardShortcutsPanel } from '@/components/common/KeyboardShortcutsPanel'
import { FeatureTour } from '@/components/onboarding/FeatureTour'

const THEME_DOTS: { theme: FocusTheme; bg: string; label: string }[] = [
  { theme: 'minimal', bg: '#ffffff', label: 'Minimal' },
  { theme: 'dark',    bg: '#1a1a1a', label: 'Dark' },
  { theme: 'sepia',   bg: '#f4ecd8', label: 'Sepia' },
  { theme: 'forest',  bg: '#1a2e1a', label: 'Forest' },
]

function FocusModeControls({ onExit }: { onExit: () => void }) {
  const { focusTheme, setFocusTheme } = useFocusThemeStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
      {/* Theme dots */}
      {THEME_DOTS.map(({ theme, bg, label }) => (
        <button
          key={theme}
          title={label}
          onClick={() => setFocusTheme(theme)}
          className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 ${
            focusTheme === theme ? 'border-white scale-125' : 'border-transparent'
          }`}
          style={{ backgroundColor: bg }}
        />
      ))}

      {/* Exit button */}
      <button
        onClick={onExit}
        title="Exit focus mode (Esc)"
        className="text-white/70 hover:text-white ml-1"
      >
        <LuX size={14} />
      </button>
    </div>
  )
}

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
  const activePanel = useEditorStore((s) => s.activePanel)
  const setActivePanel = useEditorStore((s) => s.setActivePanel)
  const focusMode = useEditorStore((s) => s.focusMode)
  const setFocusMode = useEditorStore((s) => s.setFocusMode)
  const { focusTheme } = useFocusThemeStore()
  const [showExport, setShowExport] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

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

  // F11 to enter focus mode, Escape to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        setFocusMode(true)
      }
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode, setFocusMode])

  // ? key to open keyboard shortcuts panel (when not in editor/input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '?' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement).isContentEditable) {
        setShowShortcuts(true)
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

  // ── Focus mode layout ──────────────────────────────────────────────────────
  if (focusMode) {
    return (
      <div className={`focus-wrapper focus-${focusTheme} flex flex-col`}>
        <div className="max-w-3xl mx-auto w-full flex-1 py-16 px-8 min-h-screen">
          {currentNode ? (
            <Editor projectId={projectId} nodeId={currentNode.id} node={currentNode} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm opacity-50">
              Select a scene in the binder to start writing.
            </div>
          )}
        </div>
        <FocusModeControls onExit={() => setFocusMode(false)} />
      </div>
    )
  }

  // ── Normal layout ──────────────────────────────────────────────────────────
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

        {/* Center: view toggle + panel tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => { if (showKanban) toggleKanban(); setActivePanel('editor') }}
              title="Editor view"
              data-tour="editor"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                !showKanban && activePanel === 'editor'
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LuPenLine size={13} />
              Editor
            </button>
            <button
              onClick={() => { if (!showKanban) toggleKanban(); setActivePanel('editor') }}
              title="Kanban view"
              data-tour="kanban"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                showKanban
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LuLayoutDashboard size={13} />
              Kanban
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'history' ? 'editor' : 'history')}
              title="Version history"
              data-tour="version-history"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activePanel === 'history'
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LuClock size={13} />
              History
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'goals' ? 'editor' : 'goals')}
              title="Writing goals"
              data-tour="goals"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activePanel === 'goals'
                  ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LuTarget size={13} />
              Goals
            </button>
          </div>
        </div>

        {/* Right: export + user menu */}
        <div className="flex-1 flex justify-end items-center gap-2">
          <button
            onClick={() => setFocusMode(true)}
            title="Focus mode (F11)"
            data-tour="focus-mode"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LuMaximize size={13} />
            Focus
          </button>
          <button
            onClick={() => setShowExport(true)}
            title="Export manuscript"
            data-tour="export"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LuDownload size={13} />
            Export
          </button>
          <UserMenu />
        </div>
      </div>

      {showExport && (
        <ExportDialog
          projectId={projectId}
          nodes={nodes}
          onClose={() => setShowExport(false)}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcutsPanel onClose={() => setShowShortcuts(false)} />
      )}

      <FeatureTour />

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
              data-tour="codex"
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
                <BinderTree projectId={projectId} />
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

        {/* Main content: panel-aware */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activePanel === 'history' && currentNodeId ? (
            <VersionHistoryPanel projectId={projectId} nodeId={currentNodeId} />
          ) : activePanel === 'goals' ? (
            <GoalsPanel projectId={projectId} />
          ) : showKanban ? (
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
