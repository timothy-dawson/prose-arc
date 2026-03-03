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
import { LuFolder, LuFolderPlus, LuFileText, LuFilePlus, LuPenLine, LuScrollText, LuTrash2 } from 'react-icons/lu'
import type { BinderNodeRead, NodeType } from '@/api/manuscripts'
import {
  useBinder,
  useCreateBinderNode,
  useDeleteBinderNode,
  useReorderBinder,
  useRestoreBinderNode,
  useUpdateBinderNode,
} from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPIRY_DAYS = 30

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
 *   top 25% → 'before', bottom 35% → 'after', middle 40% → 'into'
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
    if (pointerY < top + height * 0.25) return 'before'
    if (pointerY > bottom - height * 0.35) return 'after'
    return 'into'
  }
  return pointerY < top + height / 2 ? 'before' : 'after'
}

/** Walk up ancestors to find the depth of a node. */
function getNodeDepth(nodes: BinderNodeRead[], nodeId: string): number {
  let depth = 0
  let current = nodes.find((n) => n.id === nodeId)
  while (current?.parent_id) {
    depth++
    current = nodes.find((n) => n.id === current!.parent_id)
  }
  return depth
}

/**
 * Resolve the effective drop target using the drag's horizontal delta.
 *
 * Every 16px the user drags LEFT during a drag escapes one nesting level
 * (matching the 16px indentation step). Dragging straight down (deltaX ≈ 0)
 * never causes a level change, which prevents accidental sibling reordering.
 */
function resolveEffectiveDrop(
  nodes: BinderNodeRead[],
  overNode: BinderNodeRead,
  rawIntent: DropIntent,
  deltaX: number,
): { effectiveNode: BinderNodeRead; effectiveIntent: DropIntent } {
  if (rawIntent === null) return { effectiveNode: overNode, effectiveIntent: null }

  const overDepth = getNodeDepth(nodes, overNode.id)
  // Each 16px of leftward movement = escape one level; rightward = no change
  const levelEscape = Math.max(0, Math.floor(-deltaX / 16))
  const intendedDepth = Math.max(0, overDepth - levelEscape)

  if (intendedDepth >= overDepth) {
    return { effectiveNode: overNode, effectiveIntent: rawIntent }
  }

  // Walk up the ancestor chain to reach intendedDepth
  let current = overNode
  let currentDepth = overDepth
  while (currentDepth > intendedDepth && current.parent_id) {
    const parent = nodes.find((n) => n.id === current.parent_id)
    if (!parent) break
    current = parent
    currentDepth--
  }

  // Escaping to a higher level always means "after" the ancestor
  return { effectiveNode: current, effectiveIntent: 'after' }
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
    <span className={`flex-shrink-0 text-[9px] font-medium px-1 py-0.5 rounded ${color}`}>
      {days}d
    </span>
  )
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
  allNodes: BinderNodeRead[]
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
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
  allNodes,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
  onRestore,
  onAddChild,
  children,
}: NodeRowProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.title)
  const [showMenu, setShowMenu] = useState(false)

  const isDeleted = !!node.deleted_at
  const days = isDeleted ? computeDaysLeft(node.deleted_at!) : null

  // Warn on restore if parent is also deleted
  const parentAlsoDeleted =
    isDeleted &&
    node.parent_id !== null &&
    allNodes.some((n) => n.id === node.parent_id && !!n.deleted_at)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: isDeleted,
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
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm group ${
          isDeleted
            ? 'opacity-60 cursor-default'
            : isSelected
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 cursor-pointer'
            : isDropTarget
            ? 'bg-blue-50 dark:bg-blue-900/20 outline outline-2 outline-blue-400 cursor-pointer'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => { if (!isDeleted) onSelect(node.id) }}
        onDoubleClick={() => {
          if (isDeleted) return
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

        {isDeleted ? (
          <span className="w-4 flex-shrink-0" />
        ) : (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab opacity-0 group-hover:opacity-40 text-xs flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </span>
        )}

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
          <span
            className={`flex-1 truncate ${
              isDeleted ? 'line-through text-gray-400 dark:text-gray-600' : ''
            }`}
          >
            {node.title}
          </span>
        )}

        {days !== null && <DaysBadge days={days} />}

        {showMenu && (
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg text-sm py-1 min-w-[160px] text-gray-700 dark:text-gray-300"
            onMouseLeave={() => setShowMenu(false)}
          >
            {isDeleted ? (
              <>
                {parentAlsoDeleted && (
                  <p className="px-3 py-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Parent is also deleted
                  </p>
                )}
                <button
                  className="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600 dark:text-green-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRestore(node.id)
                    setShowMenu(false)
                  }}
                >
                  Restore
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
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
  onRestore: (id: string) => void
  onAddChild: (parentId: string, type: NodeType) => void
}

function TreeLevel({
  nodes,
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
  onRestore,
  onAddChild,
}: TreeProps) {
  const children = tree.get(parentId) ?? []
  if (children.length === 0) return null

  // Only live nodes are sortable; deleted nodes render but aren't drag targets
  const liveIds = children.filter((n) => !n.deleted_at).map((n) => n.id)

  return (
    <SortableContext items={liveIds} strategy={noShiftStrategy}>
      {children.map((node) => {
        const isOver = dragOverId === node.id
        const overCanContain = activeNodeType !== null && canContain(node.node_type, activeNodeType)
        const isDeleted = !!node.deleted_at

        return (
          <NodeRow
            key={node.id}
            node={node}
            projectId={projectId}
            depth={depth}
            isSelected={selectedId === node.id}
            isExpanded={expandedIds.has(node.id)}
            hasChildren={(tree.get(node.id)?.length ?? 0) > 0}
            isDropTarget={isOver && !isDeleted && dropIntent === 'into' && overCanContain}
            insertPosition={
              isOver && !isDeleted && (dropIntent === 'before' || dropIntent === 'after')
                ? dropIntent
                : null
            }
            allNodes={nodes}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onRename={onRename}
            onDelete={onDelete}
            onRestore={onRestore}
            onAddChild={onAddChild}
          >
            <TreeLevel
              nodes={nodes}
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
              onRestore={onRestore}
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
}

export function BinderTree({ projectId }: BinderTreeProps) {
  const currentNodeId = useEditorStore((s) => s.currentNodeId)
  const setCurrentNode = useEditorStore((s) => s.setCurrentNode)
  const [showDeleted, setShowDeleted] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent>(null)
  // Pointer Y at drag activation; add event.delta.y to get current pointer Y
  const activatorPointerY = useRef(0)

  const { data: nodes = [] } = useBinder(projectId, showDeleted)

  const createNode = useCreateBinderNode(projectId)
  const updateNode = useUpdateBinderNode(projectId)
  const deleteNode = useDeleteBinderNode(projectId)
  const restoreNode = useRestoreBinderNode(projectId)
  const reorder = useReorderBinder(projectId)

  const tree = buildTree(nodes)

  const activeNodeType = dragActiveId
    ? (nodes.find((n) => n.id === dragActiveId)?.node_type ?? null)
    : null

  const confirmDeleteNode = nodes.find((n) => n.id === confirmDeleteId) ?? null

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

      if (!over) {
        setDragOverId(null)
        setDropIntent(null)
        return
      }

      const overId = over.id as string
      const pointerY = activatorPointerY.current + event.delta.y
      const overNode = nodes.find((n) => n.id === overId)
      const activeNode = nodes.find((n) => n.id === (event.active.id as string))
      const overCanContain =
        overNode !== undefined &&
        activeNode !== undefined &&
        canContain(overNode.node_type, activeNode.node_type)

      const rawIntent = computeIntent(pointerY, over.rect, overCanContain)

      if (overNode) {
        const { effectiveNode, effectiveIntent } = resolveEffectiveDrop(
          nodes, overNode, rawIntent, event.delta.x,
        )
        setDragOverId(effectiveNode.id)
        setDropIntent(effectiveIntent)
      } else {
        setDragOverId(overId)
        setDropIntent(rawIntent)
      }
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

      // Don't reorder deleted nodes
      if (activeNode.deleted_at || overNode.deleted_at) return

      // Compute intent from the pointer's final position (activator Y + total delta).
      const pointerY = activatorPointerY.current + event.delta.y
      const overCanContain = canContain(overNode.node_type, activeNode.node_type)
      const rawIntent = computeIntent(pointerY, over.rect, overCanContain)

      // Resolve horizontal-level escape: dragging left exits the current nesting.
      const { effectiveNode, effectiveIntent } = resolveEffectiveDrop(
        nodes, overNode, rawIntent, event.delta.x,
      )

      // ── Case 1: Drop INTO a container ──────────────────────────────────────
      if (
        effectiveIntent === 'into' &&
        effectiveNode.id !== activeNode.parent_id &&
        !isAncestor(nodes, activeNode.id, effectiveNode.id)
      ) {
        const existingChildren = nodes.filter((n) => n.parent_id === effectiveNode.id && !n.deleted_at)
        reorder.mutate([
          {
            node_id: activeNode.id,
            parent_id: effectiveNode.id,
            sort_order: existingChildren.length,
          },
        ])
        setExpandedIds((prev) => new Set([...prev, effectiveNode.id]))
        return
      }

      // ── Case 2 & 3: Place active as a sibling of effective target ──────────
      const newParentId = effectiveNode.parent_id

      // Guard: the destination parent must be able to hold active's type
      if (newParentId !== null) {
        const newParent = nodes.find((n) => n.id === newParentId)
        if (newParent && !canContain(newParent.node_type, activeNode.node_type)) return
      }

      const siblings = nodes
        .filter((n) => n.parent_id === newParentId && n.id !== activeNode.id && !n.deleted_at)
        .sort((a, b) => a.sort_order - b.sort_order)
      const overIdx = siblings.findIndex((n) => n.id === effectiveNode.id)
      const insertIdx =
        overIdx === -1
          ? siblings.length
          : effectiveIntent === 'after'
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
    const liveRoots = nodes.filter((n) => !n.parent_id && !n.deleted_at)
    createNode.mutate({
      node_type: type,
      title: type === 'folder' ? 'New Folder' : type === 'chapter' ? 'Chapter 1' : 'Scene 1',
      sort_order: liveRoots.length,
    })
  }

  const handleAddChild = (parentId: string, type: NodeType) => {
    const siblings = nodes.filter((n) => n.parent_id === parentId && !n.deleted_at)
    createNode.mutate({
      node_type: type,
      title: type === 'folder' ? 'New Folder' : type === 'chapter' ? 'New Chapter' : 'New Scene',
      parent_id: parentId,
      sort_order: siblings.length,
    })
    setExpandedIds((prev) => new Set([...prev, parentId]))
  }

  /**
   * Context-aware toolbar add:
   * - Folder       → always root level
   * - Chapter      → inside selected folder, else root
   * - Scene        → inside selected chapter or folder, else root
   */
  const handleSmartAdd = (type: NodeType) => {
    const currentNode = currentNodeId
      ? nodes.find((n) => n.id === currentNodeId && !n.deleted_at) ?? null
      : null

    if (type === 'folder') {
      handleAddRoot('folder')
      return
    }
    if (type === 'chapter') {
      if (currentNode?.node_type === 'folder') {
        handleAddChild(currentNode.id, 'chapter')
        return
      }
      handleAddRoot('chapter')
      return
    }
    // type === 'scene'
    if (currentNode?.node_type === 'chapter' || currentNode?.node_type === 'folder') {
      handleAddChild(currentNode.id, 'scene')
      return
    }
    handleAddRoot('scene')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={() => handleSmartAdd('folder')}
          className="flex-1 flex items-center justify-center py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-yellow-500 dark:text-yellow-400"
          title="New folder"
        >
          <LuFolderPlus size={15} />
        </button>
        <button
          onClick={() => handleSmartAdd('chapter')}
          className="flex-1 flex items-center justify-center py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          title="New chapter"
        >
          <LuFilePlus size={15} />
        </button>
        <button
          onClick={() => handleSmartAdd('scene')}
          className="flex-1 flex items-center justify-center py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-teal-500 dark:text-teal-400"
          title="New scene"
        >
          <LuPenLine size={15} />
        </button>
        <button
          onClick={() => setShowDeleted((v) => !v)}
          className={`flex-1 flex items-center justify-center py-2 transition-colors ${
            showDeleted
              ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
              : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
          title={showDeleted ? 'Hide deleted items' : 'Show deleted items'}
        >
          <LuTrash2 size={14} />
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
              onDelete={(id) => setConfirmDeleteId(id)}
              onRestore={(id) => restoreNode.mutate(id)}
              onAddChild={handleAddChild}
            />
          </DndContext>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!confirmDeleteId}
        itemName={confirmDeleteNode?.title ?? ''}
        itemType={confirmDeleteNode?.node_type ?? 'item'}
        expiryDays={EXPIRY_DAYS}
        onConfirm={() => {
          if (confirmDeleteId) deleteNode.mutate(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
        isPending={deleteNode.isPending}
      />
    </div>
  )
}
