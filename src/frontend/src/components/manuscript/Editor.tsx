import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import {
  LuBold, LuItalic, LuUnderline, LuStrikethrough,
  LuHighlighter, LuType, LuLink, LuTrash2,
  LuList, LuListOrdered,
} from 'react-icons/lu'
import {
  RiInsertRowTop, RiInsertRowBottom,
  RiInsertColumnLeft, RiInsertColumnRight,
  RiDeleteRow, RiDeleteColumn,
  RiMergeCellsHorizontal, RiSplitCellsHorizontal,
  RiPaintFill,
} from 'react-icons/ri'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { BinderNodeRead } from '@/api/manuscripts'
import { useDocument, useSaveDocument, useUpdateBinderNode } from '@/hooks/useManuscript'
import { useSyncCodexMentions } from '@/hooks/useCodex'
import { useEditorStore } from '@/stores/editorStore'
import { CodexMention } from '@/extensions/CodexMentionExtension'
import { EditorToolbar } from './EditorToolbar'

interface Props {
  projectId: string
  nodeId: string
  node?: BinderNodeRead | null
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
const AUTOSAVE_DELAY = 3000

// TableCell / TableHeader extended with backgroundColor attribute for cell fill
const bgAttr = {
  default: null,
  parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
  renderHTML: (attrs: Record<string, unknown>) =>
    attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
}

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), backgroundColor: bgAttr }
  },
})

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), backgroundColor: bgAttr }
  },
})

const EXTENSIONS = [
  StarterKit.configure({ link: { openOnClick: false } }),
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image,
  TableKit.configure({ tableCell: false, tableHeader: false }),
  CustomTableCell,
  CustomTableHeader,
  TextStyle,
  FontSize,
  Color,
  Highlight.configure({ multicolor: true }),
  Placeholder.configure({ placeholder: 'Start writing…' }),
  CharacterCount,
  CodexMention,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCodexMentions(editor: TiptapEditor): string[] {
  const ids = new Set<string>()
  editor.state.doc.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'codexMention' && mark.attrs.entryId) {
        ids.add(mark.attrs.entryId as string)
      }
    }
  })
  return Array.from(ids)
}

// ─── Icon size constants ──────────────────────────────────────────────────────

const SM = 14  // bubble menu icon size

// Color picker button for bubble menus — manages its own color state
function SmColorPickerBtn({
  icon,
  title,
  defaultColor,
  onColorChange,
}: {
  icon: React.ReactNode
  title: string
  defaultColor: string
  onColorChange: (color: string) => void
}) {
  const [color, setColor] = useState(defaultColor)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); inputRef.current?.click() }}
        className="px-1.5 py-0.5 text-xs rounded border inline-flex flex-col items-center bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      >
        {icon}
        <div style={{ backgroundColor: color }} className="w-full h-0.5 rounded-sm mt-0.5" />
      </button>
      <input
        ref={inputRef}
        type="color"
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        value={color}
        onChange={(e) => { setColor(e.target.value); onColorChange(e.target.value) }}
      />
    </div>
  )
}

// Small button used inside bubble menus
function SmBtn({
  label,
  title,
  active,
  onClick,
}: {
  label: React.ReactNode
  title: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`px-1.5 py-0.5 text-xs rounded border inline-flex items-center justify-center flex-shrink-0 ${
        active
          ? 'bg-gray-800 text-white border-gray-800'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

// Small dropdown used inside bubble menus
function SmDropdown({
  label,
  title,
  items,
}: {
  label: React.ReactNode
  title: string
  items: { icon: React.ReactNode; label: string; onClick: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); setOpen(o => !o) }}
        className="px-1.5 py-0.5 text-xs rounded border inline-flex items-center gap-0.5 bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      >
        {label}
        <svg viewBox="0 0 8 5" width="7" height="5" fill="currentColor" className="ml-0.5 opacity-60">
          <path d="M0 0.5 L4 4.5 L8 0.5 Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-md z-50 min-w-max">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); item.onClick(); setOpen(false) }}
              className="flex items-center gap-1.5 w-full px-2.5 py-1 text-xs text-left text-gray-700 hover:bg-gray-50 whitespace-nowrap"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Editor({ projectId, nodeId, node }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<TiptapEditor | null>(null)
  const syncMentionsMutateRef = useRef<ReturnType<typeof useSyncCodexMentions>['mutate'] | null>(null)
  const nodeIdRef = useRef(nodeId)

  const setDirty = useEditorStore((s) => s.setDirty)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const setWordCount = useEditorStore((s) => s.setWordCount)
  const setActiveCodexEntry = useEditorStore((s) => s.setActiveCodexEntry)

  const { data: docData } = useDocument(projectId, nodeId)
  const { mutateAsync: saveDoc } = useSaveDocument(projectId, nodeId)
  const updateNode = useUpdateBinderNode(projectId)
  const syncMentions = useSyncCodexMentions(projectId)

  // keep refs current so triggerSave always uses latest values without stale closures
  useEffect(() => { nodeIdRef.current = nodeId }, [nodeId])
  useEffect(() => { syncMentionsMutateRef.current = syncMentions.mutate })

  const triggerSave = useCallback(
    (json: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await saveDoc(json)
          setSaveStatus('saved')
          setDirty(false)
          // sync codex mentions after successful save
          const ed = editorRef.current
          if (ed && !ed.isDestroyed && syncMentionsMutateRef.current) {
            const entryIds = extractCodexMentions(ed)
            syncMentionsMutateRef.current({ nodeId: nodeIdRef.current, entryIds })
          }
        } catch {
          setSaveStatus('unsaved')
        }
      }, AUTOSAVE_DELAY)
    },
    [saveDoc, setSaveStatus, setDirty],
  )

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: EMPTY_DOC,
    onUpdate: ({ editor: e }) => {
      setWordCount(e.storage.characterCount.words())
      setDirty(true)
      setSaveStatus('unsaved')
      triggerSave(e.getJSON() as Record<string, unknown>)
    },
  })

  // Load content when node or fetched document changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const content = (docData?.content ?? EMPTY_DOC) as Record<string, unknown>
    editor.commands.setContent(content, { emitUpdate: false })
    setWordCount(editor.storage.characterCount.words())
    setDirty(false)
    setSaveStatus('saved')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, docData?.binder_node_id])

  // Keep editorRef in sync so triggerSave can access latest editor without dep issues
  useEffect(() => { editorRef.current = editor }, [editor])

  // Click handler for .codex-mention spans → open codex panel
  useEffect(() => {
    if (!editor) return
    const handleClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement
      const span = target.closest('.codex-mention') as HTMLElement | null
      if (span?.dataset.codexEntryId) {
        setActiveCodexEntry(span.dataset.codexEntryId)
      }
    }
    editor.view.dom.addEventListener('click', handleClick)
    return () => editor.view.dom.removeEventListener('click', handleClick)
  }, [editor, setActiveCodexEntry])

  // Clean up autosave timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const [fillColor, setFillColor] = useState('#ffff00')
  const colorInputRef = useRef<HTMLInputElement>(null)

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />

      <textarea
        key={nodeId}
        placeholder="Scene synopsis…"
        defaultValue={node?.synopsis ?? ''}
        onBlur={(e) =>
          updateNode.mutate({ nodeId, data: { synopsis: e.target.value } })
        }
        className="w-full px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 resize-none outline-none flex-shrink-0"
        rows={2}
      />

      <div
        className="flex-1 overflow-auto relative"
        onMouseDown={(e) => {
          // Click in the padding/whitespace area below the document content —
          // forward focus to the editor so the cursor appears at the end.
          if (editor && !editor.view.dom.contains(e.target as Node)) {
            editor.commands.focus('end')
          }
        }}
      >
        {editor && (
          <>
            {/* ── Text selection bubble ── */}
            <BubbleMenu
              pluginKey="bubbleMenuText"
              editor={editor}
              shouldShow={({ state }) => {
                const { from, to } = state.selection
                return from !== to && !editor.isActive('table') && !editor.isActive('codeBlock')
              }}
              className="flex items-center gap-0.5 px-1.5 py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            >
              <SmBtn label={<LuBold size={SM} />}          title="Bold"          active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()} />
              <SmBtn label={<LuItalic size={SM} />}        title="Italic"        active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()} />
              <SmBtn label={<LuUnderline size={SM} />}     title="Underline"     active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
              <SmBtn label={<LuStrikethrough size={SM} />} title="Strikethrough" active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()} />
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <SmColorPickerBtn
                icon={<LuHighlighter size={SM} />}
                title="Highlight color"
                defaultColor="#fef08a"
                onColorChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
              />
              <SmColorPickerBtn
                icon={<LuType size={SM} />}
                title="Text color"
                defaultColor="#000000"
                onColorChange={(color) => editor.chain().focus().setColor(color).run()}
              />
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <SmBtn label={<LuLink size={SM} />} title={editor.isActive('link') ? 'Edit link' : 'Set link'} active={editor.isActive('link')} onClick={setLink} />
            </BubbleMenu>

            {/* ── Table context bubble ── */}
            <BubbleMenu
              pluginKey="bubbleMenuTable"
              editor={editor}
              shouldShow={({ editor: e }) => !!e?.isActive('table')}
              getReferencedVirtualElement={() => {
                try {
                  const { from } = editor.state.selection
                  const domPos = editor.view.domAtPos(from)
                  let node: HTMLElement | null =
                    domPos.node instanceof HTMLElement
                      ? domPos.node
                      : domPos.node.parentElement
                  while (node && node !== editor.view.dom) {
                    if (node.tagName?.toLowerCase() === 'table') {
                      const el = node
                      return {
                        getBoundingClientRect: () => el.getBoundingClientRect(),
                        getClientRects: () => [el.getBoundingClientRect()],
                      }
                    }
                    node = node.parentElement
                  }
                } catch { /* fall back to default */ }
                return null
              }}
              options={{ placement: 'top-start' }}
              className="flex items-center gap-0.5 px-1.5 py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            >
              <SmDropdown
                label={<RiInsertRowTop size={SM} />}
                title="Add row"
                items={[
                  { icon: <RiInsertRowTop size={SM} />,    label: 'Add row above', onClick: () => editor.chain().focus().addRowBefore().run() },
                  { icon: <RiInsertRowBottom size={SM} />, label: 'Add row below', onClick: () => editor.chain().focus().addRowAfter().run() },
                ]}
              />
              <SmDropdown
                label={<RiInsertColumnLeft size={SM} />}
                title="Add column"
                items={[
                  { icon: <RiInsertColumnLeft size={SM} />,  label: 'Add column left',  onClick: () => editor.chain().focus().addColumnBefore().run() },
                  { icon: <RiInsertColumnRight size={SM} />, label: 'Add column right', onClick: () => editor.chain().focus().addColumnAfter().run() },
                ]}
              />
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <SmDropdown
                label={<RiDeleteRow size={SM} />}
                title="Delete row or column"
                items={[
                  { icon: <RiDeleteRow size={SM} />,    label: 'Delete row',    onClick: () => editor.chain().focus().deleteRow().run() },
                  { icon: <RiDeleteColumn size={SM} />, label: 'Delete column', onClick: () => editor.chain().focus().deleteColumn().run() },
                ]}
              />
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <SmBtn label={<RiMergeCellsHorizontal size={SM} />} title="Merge cells" onClick={() => editor.chain().focus().mergeCells().run()} />
              <SmBtn label={<RiSplitCellsHorizontal size={SM} />} title="Split cell"  onClick={() => editor.chain().focus().splitCell().run()} />
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  title="Cell fill color"
                  onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click() }}
                  className="px-1.5 py-0.5 text-xs rounded border inline-flex flex-col items-center bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  <RiPaintFill size={SM} />
                  <div style={{ backgroundColor: fillColor }} className="w-full h-1 rounded-sm mt-0.5" />
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  value={fillColor}
                  onChange={(e) => {
                    setFillColor(e.target.value)
                    editor.chain().focus().setCellAttribute('backgroundColor', e.target.value).run()
                  }}
                />
              </div>
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <button
                type="button"
                title="Delete table"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteTable().run() }}
                className="px-1.5 py-0.5 text-xs rounded border inline-flex items-center justify-center flex-shrink-0 bg-white text-red-500 border-red-300 hover:bg-red-50"
              >
                <LuTrash2 size={SM} />
              </button>
            </BubbleMenu>

            {/* ── List context bubble ── */}
            <BubbleMenu
              pluginKey="bubbleMenuList"
              editor={editor}
              shouldShow={({ editor: e, state }) => {
                const { from, to } = state.selection
                return from === to && !!(e?.isActive('bulletList') || e?.isActive('orderedList'))
              }}
              getReferencedVirtualElement={() => {
                try {
                  const { from } = editor.state.selection
                  const domPos = editor.view.domAtPos(from)
                  let node: HTMLElement | null =
                    domPos.node instanceof HTMLElement
                      ? domPos.node
                      : domPos.node.parentElement
                  while (node && node !== editor.view.dom) {
                    const tag = node.tagName?.toLowerCase()
                    if (tag === 'ul' || tag === 'ol') {
                      const el = node
                      return {
                        getBoundingClientRect: () => el.getBoundingClientRect(),
                        getClientRects: () => [el.getBoundingClientRect()],
                      }
                    }
                    node = node.parentElement
                  }
                } catch { /* fall back to default */ }
                return null
              }}
              options={{ placement: 'top-start' }}
              className="flex items-center gap-0.5 px-1.5 py-1 bg-white border border-gray-200 rounded-md shadow-lg"
            >
              <SmBtn label="←" title="Outdent" onClick={() => editor.chain().focus().liftListItem('listItem').run()} />
              <SmBtn label="→" title="Indent"  onClick={() => editor.chain().focus().sinkListItem('listItem').run()} />
              <div className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />
              <SmBtn label={<LuList size={SM} />}        title="Bullet list"  active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <SmBtn label={<LuListOrdered size={SM} />} title="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
            </BubbleMenu>
          </>
        )}

        <EditorContent
          editor={editor}
          className="prose prose-gray dark:prose-invert max-w-none p-8 min-h-full focus-within:outline-none [&_.tiptap]:outline-none"
        />
      </div>
    </div>
  )
}
