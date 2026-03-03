import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { LuPenLine } from 'react-icons/lu'
import type { BinderNodeRead } from '@/api/manuscripts'
import { useDocument, useUpdateBinderNode } from '@/hooks/useManuscript'

// Same table cell extensions as Editor.tsx for correct rendering of custom table attrs
const bgAttr = {
  default: null,
  parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
  renderHTML: (attrs: Record<string, unknown>) =>
    attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
}
const DisplayTableCell = TableCell.extend({
  addAttributes() { return { ...this.parent?.(), backgroundColor: bgAttr } },
})
const DisplayTableHeader = TableHeader.extend({
  addAttributes() { return { ...this.parent?.(), backgroundColor: bgAttr } },
})

// Read-only extension set — full fidelity but no editing-specific extensions
const VIEW_EXTENSIONS = [
  StarterKit,
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image,
  TableKit.configure({ tableCell: false, tableHeader: false }),
  DisplayTableCell,
  DisplayTableHeader,
  TextStyle,
  FontSize,
  Color,
  Highlight.configure({ multicolor: true }),
]

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

// ─── Scene block ─────────────────────────────────────────────────────────────

interface SceneBlockProps {
  projectId: string
  scene: BinderNodeRead
  onEdit: (id: string) => void
}

function SceneBlock({ projectId, scene, onEdit }: SceneBlockProps) {
  const { data: docData, isLoading } = useDocument(projectId, scene.id)

  const editor = useEditor({
    extensions: VIEW_EXTENSIONS,
    editable: false,
    content: EMPTY_DOC,
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const content = (docData?.content ?? EMPTY_DOC) as Record<string, unknown>
    editor.commands.setContent(content, { emitUpdate: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, docData?.binder_node_id])

  const isEmpty =
    !isLoading &&
    editor &&
    editor.state.doc.textContent.trim() === '' &&
    editor.state.doc.childCount <= 1

  return (
    <div className="mb-12">
      {/* Scene divider */}
      <div className="flex items-center gap-3 mb-4 group">
        <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 flex-shrink-0">{scene.title}</span>
        <button
          onClick={() => onEdit(scene.id)}
          className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 px-1.5 py-0.5 rounded transition-opacity"
        >
          <LuPenLine size={11} />
          Edit
        </button>
        <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
      </div>

      {/* Scene synopsis */}
      {scene.synopsis && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-4">{scene.synopsis}</p>
      )}

      {/* Scene content */}
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-4/6" />
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-gray-300 dark:text-gray-600 italic">No content yet.</p>
      ) : (
        <EditorContent
          editor={editor}
          className="prose prose-gray dark:prose-invert max-w-none [&_.tiptap]:outline-none pointer-events-none select-text"
        />
      )}
    </div>
  )
}

// ─── Scrivenings view ────────────────────────────────────────────────────────

interface Props {
  projectId: string
  node: BinderNodeRead   // the chapter
  scenes: BinderNodeRead[]
  onEditScene: (id: string) => void
}

export function ScriveningsView({ projectId, node, scenes, onEditScene }: Props) {
  const updateNode = useUpdateBinderNode(projectId)
  const sortedScenes = [...scenes].sort((a, b) => a.sort_order - b.sort_order)
  const totalWords = scenes.reduce((s, sc) => s + sc.word_count, 0)

  return (
    <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
      <div className="max-w-2xl mx-auto w-full px-8 py-10">
        {/* Chapter header */}
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">{node.title}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          {totalWords.toLocaleString()} words &middot; {sortedScenes.length}{' '}
          {sortedScenes.length === 1 ? 'scene' : 'scenes'}
        </p>

        {/* Chapter synopsis */}
        <textarea
          key={node.id}
          placeholder="Chapter synopsis…"
          defaultValue={node.synopsis ?? ''}
          onBlur={(e) =>
            updateNode.mutate({ nodeId: node.id, data: { synopsis: e.target.value } })
          }
          rows={2}
          className="w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-md resize-none outline-none focus:border-blue-200 dark:focus:border-blue-700 focus:bg-white dark:focus:bg-gray-800 mb-10 block transition-colors placeholder-gray-400 dark:placeholder-gray-600"
        />

        {/* Scenes */}
        {sortedScenes.map((scene) => (
          <SceneBlock
            key={scene.id}
            projectId={projectId}
            scene={scene}
            onEdit={onEditScene}
          />
        ))}
      </div>
    </div>
  )
}
