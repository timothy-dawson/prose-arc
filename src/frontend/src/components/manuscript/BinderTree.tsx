import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BinderNodeRead, NodeType } from '@/api/manuscripts'
import {
  useCreateBinderNode,
  useDeleteBinderNode,
  useReorderBinder,
  useUpdateBinderNode,
} from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTree(nodes: BinderNodeRead[]): Map<string | null, BinderNodeRead[]> {
  const map = new Map<string | null, BinderNodeRead[]>()
  for (const node of nodes) {
    const children = map.get(node.parent_id) ?? []
    children.push(node)
    map.set(node.parent_id, children)
  }
  // Sort children by sort_order within each parent
  for (const [, children] of map) {
    children.sort((a, b) => a.sort_order - b.sort_order)
  }
  return map
}

const NODE_ICONS: Record<NodeType, string> = {
  folder: '📁',
  chapter: '📄',
  scene: '📝',
  front_matter: '📋',
  back_matter: '📋',
}

// ---------------------------------------------------------------------------
// Sortable node row
// ---------------------------------------------------------------------------

interface NodeRowProps {
  node: BinderNodeRead
  projectId: string
  depth: number
  isSelected: boolean
  isExpanded: boolean
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string, type: NodeType) => void
  children?: React.ReactNode
}

function NodeRow({
  node,
  depth,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
  onAddChild,
  children,
}: NodeRowProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.title)
  const [showMenu, setShowMenu] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const commitRename = () => {
    if (editValue.trim() && editValue !== node.title) {
      onRename(node.id, editValue.trim())
    }
    setEditing(false)
  }

  const isFolder = node.node_type === 'folder'

  return (
    <div ref={setNodeRef} style={style} className="select-none">
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm group ${
          isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => {
          setEditValue(node.title)
          setEditing(true)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowMenu(true)
        }}
      >
        {/* Expand toggle for folders */}
        {isFolder ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
            className="text-xs w-4 flex-shrink-0"
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-40 text-xs flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>

        <span className="flex-shrink-0">{NODE_ICONS[node.node_type]}</span>

        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm border border-blue-400 rounded px-1 outline-none"
          />
        ) : (
          <span className="flex-1 truncate">{node.title}</span>
        )}

        {/* Context menu */}
        {showMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded shadow-lg text-sm py-1 min-w-[160px]"
            onMouseLeave={() => setShowMenu(false)}
          >
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation()
                setEditValue(node.title)
                setEditing(true)
                setShowMenu(false)
              }}
            >
              Rename
            </button>
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(node.id, 'folder')
                setShowMenu(false)
              }}
            >
              Add folder
            </button>
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(node.id, 'chapter')
                setShowMenu(false)
              }}
            >
              Add chapter
            </button>
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(node.id, 'scene')
                setShowMenu(false)
              }}
            >
              Add scene
            </button>
            <hr className="my-1 border-gray-200" />
            <button
              className="w-full text-left px-3 py-1 hover:bg-red-50 text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(node.id)
                setShowMenu(false)
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recursive tree renderer
// ---------------------------------------------------------------------------

interface TreeProps {
  nodes: BinderNodeRead[]
  tree: Map<string | null, BinderNodeRead[]>
  parentId: string | null
  projectId: string
  depth: number
  selectedId: string | null
  expandedIds: Set<string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string, type: NodeType) => void
}

function TreeLevel({
  tree,
  parentId,
  projectId,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
  onAddChild,
}: TreeProps) {
  const children = tree.get(parentId) ?? []
  if (children.length === 0) return null

  return (
    <SortableContext
      items={children.map((n) => n.id)}
      strategy={verticalListSortingStrategy}
    >
      {children.map((node) => (
        <NodeRow
          key={node.id}
          node={node}
          projectId={projectId}
          depth={depth}
          isSelected={selectedId === node.id}
          isExpanded={expandedIds.has(node.id)}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onRename={onRename}
          onDelete={onDelete}
          onAddChild={onAddChild}
        >
          <TreeLevel
            nodes={[]}
            tree={tree}
            parentId={node.id}
            projectId={projectId}
            depth={depth + 1}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onRename={onRename}
            onDelete={onDelete}
            onAddChild={onAddChild}
          />
        </NodeRow>
      ))}
    </SortableContext>
  )
}

// ---------------------------------------------------------------------------
// BinderTree
// ---------------------------------------------------------------------------

interface BinderTreeProps {
  projectId: string
  nodes: BinderNodeRead[]
}

export function BinderTree({ projectId, nodes }: BinderTreeProps) {
  const currentNodeId = useEditorStore((s) => s.currentNodeId)
  const setCurrentNode = useEditorStore((s) => s.setCurrentNode)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const createNode = useCreateBinderNode(projectId)
  const updateNode = useUpdateBinderNode(projectId)
  const deleteNode = useDeleteBinderNode(projectId)
  const reorder = useReorderBinder(projectId)

  const tree = buildTree(nodes)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeNode = nodes.find((n) => n.id === active.id)
      const overNode = nodes.find((n) => n.id === over.id)
      if (!activeNode || !overNode) return

      // Reorder within same parent: swap sort_orders
      const siblings = (tree.get(activeNode.parent_id) ?? []).filter(
        (n) => n.id !== activeNode.id,
      )
      const overIdx = siblings.findIndex((n) => n.id === over.id)
      const insertIdx = overIdx === -1 ? siblings.length : overIdx

      const updatedSiblings = [
        ...siblings.slice(0, insertIdx),
        activeNode,
        ...siblings.slice(insertIdx),
      ]

      const reorderPayload = updatedSiblings.map((n, idx) => ({
        node_id: n.id,
        parent_id: n.parent_id,
        sort_order: idx,
      }))

      reorder.mutate(reorderPayload)
    },
    [nodes, tree, reorder],
  )

  const handleAddRoot = (type: NodeType) => {
    createNode.mutate({
      node_type: type,
      title: type === 'folder' ? 'New Folder' : type === 'chapter' ? 'Chapter 1' : 'Scene 1',
      sort_order: nodes.filter((n) => !n.parent_id).length,
    })
  }

  const handleAddChild = (parentId: string, type: NodeType) => {
    const siblings = nodes.filter((n) => n.parent_id === parentId)
    createNode.mutate({
      node_type: type,
      title: type === 'folder' ? 'New Folder' : type === 'chapter' ? 'New Chapter' : 'New Scene',
      parent_id: parentId,
      sort_order: siblings.length,
    })
    setExpandedIds((prev) => new Set([...prev, parentId]))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Add root buttons */}
      <div className="flex gap-1 p-2 border-b border-gray-200">
        <button
          onClick={() => handleAddRoot('folder')}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          title="New folder"
        >
          + Folder
        </button>
        <button
          onClick={() => handleAddRoot('chapter')}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          title="New chapter"
        >
          + Chapter
        </button>
        <button
          onClick={() => handleAddRoot('scene')}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          title="New scene"
        >
          + Scene
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {nodes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            No chapters yet. Add one above.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <TreeLevel
              nodes={nodes}
              tree={tree}
              parentId={null}
              projectId={projectId}
              depth={0}
              selectedId={currentNodeId}
              expandedIds={expandedIds}
              onSelect={setCurrentNode}
              onToggleExpand={(id) =>
                setExpandedIds((prev) => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                })
              }
              onRename={(id, title) => updateNode.mutate({ nodeId: id, data: { title } })}
              onDelete={(id) => deleteNode.mutate(id)}
              onAddChild={handleAddChild}
            />
          </DndContext>
        )}
      </div>
    </div>
  )
}
