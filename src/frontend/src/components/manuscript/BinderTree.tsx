import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuFolder, LuFileText, LuPenLine, LuScrollText } from 'react-icons/lu'
import type { BinderNodeRead, NodeType } from '@/api/manuscripts'
import {
  useCreateBinderNode,
  useDeleteBinderNode,
  useReorderBinder,
  useUpdateBinderNode,
} from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type DropIntent = 'into' | 'before' | 'after' | null

function buildTree(nodes: BinderNodeRead[]): Map<string | null, BinderNodeRead[]> {
  const map = new Map<string | null, BinderNodeRead[]>()
  for (const node of nodes) {
    const children = map.get(node.parent_id) ?? []
    children.push(node)
    map.set(node.parent_id, children)
  }
  for (const [, children] of map) {
    children.sort((a, b) => a.sort_order - b.sort_order)
  }
  return map
}

/** Returns true if a node of parentType can directly contain a node of childType. */
function canContain(parentType: NodeType, childType: NodeType): boolean {
  if (parentType === 'folder') return true
  if (parentType === 'chapter') return childType === 'scene'
  return false
}

/** Returns true if potentialAncestorId is an ancestor of nodeId. */
function isAncestor(nodes: BinderNodeRead[], potentialAncestorId: string, nodeId: string): boolean {
  let current = nodes.find((n) => n.id === nodeId)
  while (current?.parent_id) {
    if (current.parent_id === potentialAncestorId) return true
    current = nodes.find((n) => n.id === current!.parent_id)
  }
  return false
}

/**
 * Compute drop intent from the pointer Y vs the over element's bounding rect.
 *
 * Container nodes (folder/chapter that can hold the dragged type):
 *   top 25% → 'before', bottom 25% → 'after', middle 50% → 'into'
 * Non-container targets:
 *   top half → 'before', bottom half → 'after'
 */
function computeIntent(
  pointerY: number,
  overRect: { top: number; bottom: number; height: number },
  overCanContain: boolean,
): DropIntent {
  const { top, bottom, height } = overRect
  if (overCanContain) {
    const band = height * 0.25
    if (pointerY < top + band) return 'before'
    if (pointerY > bottom - band) return 'after'
    return 'into'
  }
  return pointerY < top + height / 2 ? 'before' : 'after'
}

// No-op sorting strategy: items stay in place during drag; the insertion line
// is the only visual feedback (no row-shifting animation).
const noShiftStrategy = () => null

function NodeIcon({ type }: { type: NodeType }) {
  switch (type) {
    case 'folder':      return <LuFolder size={14} className="flex-shrink-0 text-yellow-500" />
    case 'chapter':     return <LuFileText size={14} className="flex-shrink-0 text-gray-500" />
    case 'scene':       return <LuPenLine size={14} className="flex-shrink-0 text-teal-500" />
    case 'front_matter':
    case 'back_matter': return <LuScrollText size={14} className="flex-shrink-0 text-gray-400" />
  }
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
  hasChildren: boolean
  isDropTarget: boolean
  insertPosition: 'before' | 'after' | null
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
  hasChildren,
  isDropTarget,
  insertPosition,
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
    opacity: isDragging ? 0.4 : 1,
  }

  const commitRename = () => {
    if (editValue.trim() && editValue !== node.title) {
      onRename(node.id, editValue.trim())
    }
    setEditing(false)
  }

  return (
    <div ref={setNodeRef} style={style} className="select-none relative">
      {insertPosition === 'before' && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-blue-500 rounded z-10 pointer-events-none" />
      )}

      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm group ${
          isSelected
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200'
            : isDropTarget
            ? 'bg-blue-50 dark:bg-blue-900/20 outline outline-2 outline-blue-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'
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
        {hasChildren ? (
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

        <span
          {...attributes}
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-40 text-xs flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>

        <NodeIcon type={node.node_type} />

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
            className="flex-1 text-sm border border-blue-400 rounded px-1 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        ) : (
          <span className="flex-1 truncate">{node.title}</span>
        )}

        {showMenu && (
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg text-sm py-1 min-w-[160px] text-gray-700 dark:text-gray-300"
            onMouseLeave={() => setShowMenu(false)}
          >
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
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
              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(node.id, 'folder')
                setShowMenu(false)
              }}
            >
              Add folder
            </button>
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(node.id, 'chapter')
                setShowMenu(false)
              }}
            >
              Add chapter
            </button>
            <button
              className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(node.id, 'scene')
                setShowMenu(false)
              }}
            >
              Add scene
            </button>
            <hr className="my-1 border-gray-200 dark:border-gray-700" />
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

      {insertPosition === 'after' && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded z-10 pointer-events-none" />
      )}

      {isExpanded && children}
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
  dragOverId: string | null
  dropIntent: DropIntent
  activeNodeType: NodeType | null
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
  dragOverId,
  dropIntent,
  activeNodeType,
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
      strategy={noShiftStrategy}
    >
      {children.map((node) => {
        const isOver = dragOverId === node.id
        const overCanContain = activeNodeType !== null && canContain(node.node_type, activeNodeType)

        return (
          <NodeRow
            key={node.id}
            node={node}
            projectId={projectId}
            depth={depth}
            isSelected={selectedId === node.id}
            isExpanded={expandedIds.has(node.id)}
            hasChildren={(tree.get(node.id)?.length ?? 0) > 0}
            isDropTarget={isOver && dropIntent === 'into' && overCanContain}
            insertPosition={
              isOver && (dropIntent === 'before' || dropIntent === 'after') ? dropIntent : null
            }
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
              dragOverId={dragOverId}
              dropIntent={dropIntent}
              activeNodeType={activeNodeType}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          </NodeRow>
        )
      })}
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
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent>(null)
  // Pointer Y at drag activation; add event.delta.y to get current pointer Y
  const activatorPointerY = useRef(0)

  const createNode = useCreateBinderNode(projectId)
  const updateNode = useUpdateBinderNode(projectId)
  const deleteNode = useDeleteBinderNode(projectId)
  const reorder = useReorderBinder(projectId)

  const tree = buildTree(nodes)

  const activeNodeType = dragActiveId
    ? (nodes.find((n) => n.id === dragActiveId)?.node_type ?? null)
    : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 4px movement before drag activates — prevents click interference
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as string)
    setDropIntent(null)
    activatorPointerY.current = (event.activatorEvent as PointerEvent).clientY
  }, [])

  /**
   * onDragMove fires on every pointer move — use it purely for visual feedback.
   * Pointer Y = activatorPointerY + cumulative delta (delta is total offset from
   * the activation point, not per-frame).
   */
  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over } = event
      const overId = (over?.id as string) ?? null
      setDragOverId(overId)

      if (!over) {
        setDropIntent(null)
        return
      }

      const pointerY = activatorPointerY.current + event.delta.y
      const overNode = nodes.find((n) => n.id === overId)
      const activeNode = nodes.find((n) => n.id === (event.active.id as string))
      const overCanContain =
        overNode !== undefined &&
        activeNode !== undefined &&
        canContain(overNode.node_type, activeNode.node_type)

      setDropIntent(computeIntent(pointerY, over.rect, overCanContain))
    },
    [nodes],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragActiveId(null)
      setDragOverId(null)
      setDropIntent(null)

      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeNode = nodes.find((n) => n.id === active.id)
      const overNode = nodes.find((n) => n.id === over.id)
      if (!activeNode || !overNode) return

      // Compute intent from the pointer's final position (activator Y + total delta).
      const pointerY = activatorPointerY.current + event.delta.y
      const overCanContain = canContain(overNode.node_type, activeNode.node_type)
      const intent = computeIntent(pointerY, over.rect, overCanContain)

      // ── Case 1: Drop INTO a container ──────────────────────────────────────
      if (
        intent === 'into' &&
        overNode.id !== activeNode.parent_id &&
        !isAncestor(nodes, activeNode.id, overNode.id)
      ) {
        const existingChildren = nodes.filter((n) => n.parent_id === overNode.id)
        reorder.mutate([
          {
            node_id: activeNode.id,
            parent_id: overNode.id,
            sort_order: existingChildren.length,
          },
        ])
        setExpandedIds((prev) => new Set([...prev, overNode.id]))
        return
      }

      // ── Case 2 & 3: Place active as a sibling of over ──────────────────────
      const newParentId = overNode.parent_id

      // Guard: the destination parent must be able to hold active's type
      if (newParentId !== null) {
        const newParent = nodes.find((n) => n.id === newParentId)
        if (newParent && !canContain(newParent.node_type, activeNode.node_type)) return
      }

      const siblings = nodes.filter(
        (n) => n.parent_id === newParentId && n.id !== activeNode.id,
      )
      const overIdx = siblings.findIndex((n) => n.id === overNode.id)
      const insertIdx =
        overIdx === -1
          ? siblings.length
          : intent === 'after'
          ? overIdx + 1
          : overIdx

      const updated = [
        ...siblings.slice(0, insertIdx),
        activeNode,
        ...siblings.slice(insertIdx),
      ]

      reorder.mutate(
        updated.map((n, idx) => ({
          node_id: n.id,
          parent_id: newParentId,
          sort_order: idx,
        })),
      )
    },
    [nodes, reorder],
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
      <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={() => handleAddRoot('folder')}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          title="New folder"
        >
          + Folder
        </button>
        <button
          onClick={() => handleAddRoot('chapter')}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          title="New chapter"
        >
          + Chapter
        </button>
        <button
          onClick={() => handleAddRoot('scene')}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          title="New scene"
        >
          + Scene
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 bg-white dark:bg-gray-900">
        {nodes.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
            No chapters yet. Add one above.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
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
              dragOverId={dragOverId}
              dropIntent={dropIntent}
              activeNodeType={activeNodeType}
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
