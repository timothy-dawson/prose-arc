import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuPlus } from 'react-icons/lu'
import type { BinderNodeRead } from '@/api/manuscripts'
import { useEditorStore } from '@/stores/editorStore'
import { useCreateBinderNode, useReorderBinder } from '@/hooks/useManuscript'

interface Props {
  projectId: string
  nodes: BinderNodeRead[]
}

// ---------------------------------------------------------------------------
// Scene card (sortable)
// ---------------------------------------------------------------------------

function SceneCard({ node }: { node: BinderNodeRead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  })
  const setCurrentNode = useEditorStore((s) => s.setCurrentNode)
  const toggleKanban = useEditorStore((s) => s.toggleKanban)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing select-none"
      {...attributes}
      {...listeners}
    >
      <button
        className="w-full text-left"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          setCurrentNode(node.id)
          toggleKanban()
        }}
      >
        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{node.title}</p>
        {node.synopsis && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{node.synopsis}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{node.word_count.toLocaleString()} words</span>
        </div>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column (chapter)
// ---------------------------------------------------------------------------

function Column({
  chapter,
  scenes,
  projectId,
}: {
  chapter: BinderNodeRead
  scenes: BinderNodeRead[]
  projectId: string
}) {
  const createNode = useCreateBinderNode(projectId)

  const handleAddScene = () => {
    createNode.mutate({
      node_type: 'scene',
      title: 'New Scene',
      parent_id: chapter.id,
      sort_order: scenes.length,
    })
  }

  return (
    <div className="flex flex-col flex-shrink-0 w-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 gap-2">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate px-1">{chapter.title}</h3>
      <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[4rem]">
          {scenes.map((scene) => (
            <SceneCard key={scene.id} node={scene} />
          ))}
        </div>
      </SortableContext>
      <button
        onClick={handleAddScene}
        className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-1 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 mt-1"
      >
        <LuPlus size={12} /> Add Scene
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

export function KanbanBoard({ projectId, nodes }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const reorder = useReorderBinder(projectId)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Build chapter list in the same depth-first order as the binder tree.
  // A flat sort_order sort breaks when chapters are nested inside folders,
  // since each folder resets sort_order from 0.
  function getChaptersInTreeOrder(allNodes: BinderNodeRead[], parentId: string | null): BinderNodeRead[] {
    return allNodes
      .filter((n) => n.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((n) =>
        n.node_type === 'chapter'
          ? [n]
          : n.node_type === 'folder'
            ? getChaptersInTreeOrder(allNodes, n.id)
            : [],
      )
  }

  const chapters = getChaptersInTreeOrder(nodes, null)

  const scenesFor = (chapterId: string) =>
    nodes
      .filter((n) => n.node_type === 'scene' && n.parent_id === chapterId)
      .sort((a, b) => a.sort_order - b.sort_order)

  const activeNode = activeId ? nodes.find((n) => n.id === activeId) : null

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const draggedNode = nodes.find((n) => n.id === active.id)
    if (!draggedNode) return

    // Determine new parent: check if 'over' is a chapter or a scene
    const overNode = nodes.find((n) => n.id === over.id)
    if (!overNode) return

    const newParentId = overNode.node_type === 'chapter' ? overNode.id : overNode.parent_id

    if (!newParentId) return

    // Build new order for the target column
    const targetScenes = scenesFor(newParentId).filter((s) => s.id !== active.id)
    const overIndex = targetScenes.findIndex((s) => s.id === over.id)
    const insertAt = overIndex === -1 ? targetScenes.length : overIndex

    const reordered = [
      ...targetScenes.slice(0, insertAt),
      { ...draggedNode, parent_id: newParentId },
      ...targetScenes.slice(insertAt),
    ]

    const reorderPayload = reordered.map((s, i) => ({
      node_id: s.id,
      parent_id: newParentId,
      sort_order: i,
    }))

    // Include other scenes that didn't move (preserve their sort_order)
    const otherScenes = nodes
      .filter((n) => n.node_type === 'scene' && n.parent_id !== newParentId && n.id !== active.id)
      .map((s) => ({ node_id: s.id, parent_id: s.parent_id!, sort_order: s.sort_order }))

    reorder.mutate([...reorderPayload, ...otherScenes])
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden p-4 bg-white dark:bg-gray-900">
        {chapters.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            Create chapters in the binder to use the kanban view.
          </div>
        ) : (
          chapters.map((chapter) => (
            <Column
              key={chapter.id}
              chapter={chapter}
              scenes={scenesFor(chapter.id)}
              projectId={projectId}
            />
          ))
        )}
      </div>
      <DragOverlay>
        {activeNode && (
          <div className="bg-white dark:bg-gray-900 border border-blue-300 rounded-lg p-3 shadow-lg opacity-90 w-64">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{activeNode.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
