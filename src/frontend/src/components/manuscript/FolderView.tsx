import { LuFolder, LuFileText, LuPenLine } from 'react-icons/lu'
import type { BinderNodeRead } from '@/api/manuscripts'
import { useUpdateBinderNode } from '@/hooks/useManuscript'

interface Props {
  projectId: string
  node: BinderNodeRead
  allNodes: BinderNodeRead[]
  onSelect: (id: string) => void
}

function totalDescendantWords(allNodes: BinderNodeRead[], nodeId: string): number {
  const children = allNodes.filter((n) => n.parent_id === nodeId)
  return children.reduce(
    (sum, child) => sum + child.word_count + totalDescendantWords(allNodes, child.id),
    0,
  )
}

const CHILD_ICONS: Record<string, React.ReactNode> = {
  folder:      <LuFolder   size={13} className="text-yellow-500 flex-shrink-0" />,
  chapter:     <LuFileText size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />,
  scene:       <LuPenLine  size={13} className="text-teal-500 flex-shrink-0" />,
  front_matter:<LuFileText size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />,
  back_matter: <LuFileText size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />,
}

export function FolderView({ projectId, node, allNodes, onSelect }: Props) {
  const updateNode = useUpdateBinderNode(projectId)
  const totalWords = totalDescendantWords(allNodes, node.id)
  const directChildren = allNodes
    .filter((n) => n.parent_id === node.id)
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="max-w-xl mx-auto w-full px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <LuFolder size={22} className="text-yellow-500 flex-shrink-0" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{node.title}</h2>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-8 pl-9">
          {totalWords.toLocaleString()} words &middot; {directChildren.length}{' '}
          {directChildren.length === 1 ? 'item' : 'items'}
        </p>

        {/* Synopsis */}
        <div className="mb-8">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Synopsis
          </label>
          <textarea
            key={node.id}
            placeholder="Add a synopsis for this folder…"
            defaultValue={node.synopsis ?? ''}
            onBlur={(e) =>
              updateNode.mutate({ nodeId: node.id, data: { synopsis: e.target.value } })
            }
            rows={4}
            className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md resize-none outline-none focus:border-blue-300 dark:focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-shadow placeholder-gray-400 dark:placeholder-gray-600"
          />
        </div>

        {/* Contents */}
        {directChildren.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Contents
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
              {directChildren.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSelect(child.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {CHILD_ICONS[child.node_type]}
                  <span className="flex-1 truncate">{child.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">
                    {child.word_count.toLocaleString()} wds
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
