import { useEditorStore } from '@/stores/editorStore'
import { useProject } from '@/hooks/useManuscript'
import type { BinderNodeRead } from '@/api/manuscripts'

interface StatusBarProps {
  projectId: string
  nodes: BinderNodeRead[]
}

function buildBreadcrumb(nodes: BinderNodeRead[], nodeId: string | null): string {
  if (!nodeId) return ''
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const parts: string[] = []
  let current = nodeMap.get(nodeId)
  while (current) {
    parts.unshift(current.title)
    current = current.parent_id ? nodeMap.get(current.parent_id) : undefined
  }
  return parts.join(' › ')
}

function SaveIndicator({ status }: { status: 'saved' | 'saving' | 'unsaved' }) {
  if (status === 'saving') {
    return <span className="text-blue-500">Saving…</span>
  }
  if (status === 'unsaved') {
    return <span className="text-amber-500">Unsaved</span>
  }
  return <span className="text-gray-400">Saved</span>
}

export function StatusBar({ projectId, nodes }: StatusBarProps) {
  const currentNodeId = useEditorStore((s) => s.currentNodeId)
  const wordCount = useEditorStore((s) => s.wordCount)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const { data: project } = useProject(projectId)

  const breadcrumb = buildBreadcrumb(nodes, currentNodeId)

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 select-none">
      {/* Left: breadcrumb */}
      <span className="truncate max-w-xs" title={breadcrumb}>
        {breadcrumb || '—'}
      </span>

      {/* Right: word counts + save status */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <span>{wordCount.toLocaleString()} words</span>
        {project && (
          <span className="text-gray-400">
            Project: {project.word_count.toLocaleString()} words
          </span>
        )}
        <SaveIndicator status={saveStatus} />
      </div>
    </div>
  )
}
