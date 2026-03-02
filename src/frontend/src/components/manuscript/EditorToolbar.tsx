import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import {
  LuUndo2, LuRedo2,
  LuBold, LuItalic, LuUnderline, LuStrikethrough,
  LuHighlighter, LuType,
  LuSubscript, LuSuperscript,
  LuAlignLeft, LuAlignCenter, LuAlignRight, LuAlignJustify,
  LuList, LuListOrdered, LuQuote,
  LuCode, LuLink, LuUnlink, LuImage,
  LuTable, LuChevronDown, LuSearch,
} from 'react-icons/lu'
import { useEditorStore } from '@/stores/editorStore'

interface Props {
  editor: Editor | null
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Divider() {
  return <div className="w-px h-5 bg-gray-300 mx-1 flex-shrink-0" />
}

function Btn({
  label,
  title,
  active,
  disabled,
  onClick,
}: {
  label: React.ReactNode
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`px-2 py-1 text-sm rounded border flex-shrink-0 inline-flex items-center justify-center ${
        active
          ? 'bg-gray-800 text-white border-gray-800'
          : disabled
            ? 'bg-white text-gray-300 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Text style dropdown ──────────────────────────────────────────────────────

const TEXT_STYLES = [
  {
    label: 'Normal',
    cls: 'text-sm',
    isActive: (e: Editor) => e.isActive('paragraph'),
    apply:    (e: Editor) => e.chain().focus().setParagraph().run(),
  },
  {
    label: 'Title',
    cls: 'text-xl font-bold',
    isActive: (e: Editor) => e.isActive('heading', { level: 1 }),
    apply:    (e: Editor) => e.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    label: 'Subtitle',
    cls: 'text-lg font-semibold',
    isActive: (e: Editor) => e.isActive('heading', { level: 2 }),
    apply:    (e: Editor) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 1',
    cls: 'text-base font-bold',
    isActive: (e: Editor) => e.isActive('heading', { level: 3 }),
    apply:    (e: Editor) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    label: 'Heading 2',
    cls: 'text-sm font-bold',
    isActive: (e: Editor) => e.isActive('heading', { level: 4 }),
    apply:    (e: Editor) => e.chain().focus().setHeading({ level: 4 }).run(),
  },
  {
    label: 'Heading 3',
    cls: 'text-xs font-bold',
    isActive: (e: Editor) => e.isActive('heading', { level: 5 }),
    apply:    (e: Editor) => e.chain().focus().setHeading({ level: 5 }).run(),
  },
]

function TextStyleMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (ev: MouseEvent) => {
      if (
        !triggerRef.current?.contains(ev.target as Node) &&
        !panelRef.current?.contains(ev.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = TEXT_STYLES.find(s => s.isActive(editor)) ?? TEXT_STYLES[0]

  const toggle = (ev: React.MouseEvent) => {
    ev.preventDefault()
    if (!open) setRect(triggerRef.current?.getBoundingClientRect() ?? null)
    setOpen(o => !o)
  }

  return (
    <div className="flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title="Text style"
        onMouseDown={toggle}
        className="px-2 py-1 text-sm rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1.5 min-w-[5.5rem]"
      >
        <span className="flex-1 text-left text-sm">{current.label}</span>
        <LuChevronDown size={12} className="opacity-60 flex-shrink-0" />
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded shadow-md py-1 min-w-[10rem]"
        >
          {TEXT_STYLES.map(style => (
            <button
              key={style.label}
              type="button"
              onMouseDown={(ev) => { ev.preventDefault(); style.apply(editor); setOpen(false) }}
              className={`block w-full px-3 py-1.5 text-left hover:bg-gray-50 ${style.cls} ${style.isActive(editor) ? 'bg-gray-100' : ''}`}
            >
              {style.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Font size control ────────────────────────────────────────────────────────

function FontSizeControl({ editor }: { editor: Editor }) {
  const [inputVal, setInputVal] = useState('')
  const isFocused = useRef(false)

  useEffect(() => {
    const sync = () => {
      if (isFocused.current) return

      // Prefer the explicit TipTap mark attribute (set via toolbar).
      const markSize = editor.getAttributes('textStyle').fontSize as string | undefined
      if (markSize) {
        setInputVal(markSize.replace('px', ''))
        return
      }

      // Fall back to the computed DOM font size so unstyled/inherited text
      // (normal paragraphs, headings, etc.) still shows a real number.
      try {
        const { from } = editor.state.selection
        const domPos = editor.view.domAtPos(from)
        const el = domPos.node instanceof Element
          ? (domPos.node as Element)
          : domPos.node.parentElement
        if (el) {
          const px = parseFloat(window.getComputedStyle(el).fontSize)
          if (!isNaN(px)) { setInputVal(String(Math.round(px))); return }
        }
      } catch { /* ignore */ }

      setInputVal('')
    }
    editor.on('transaction', sync)
    sync() // read initial value
    return () => { editor.off('transaction', sync) }
  }, [editor])

  const apply = (val: string) => {
    const n = parseInt(val, 10)
    if (!val.trim() || isNaN(n) || n <= 0) {
      editor.chain().focus().unsetFontSize().run()
    } else {
      editor.chain().focus().setFontSize(`${n}px`).run()
    }
  }

  const step = (delta: number) => {
    const base = parseInt(inputVal, 10) || 12
    const next = Math.max(1, base + delta)
    setInputVal(String(next))
    editor.chain().focus().setFontSize(`${next}px`).run()
  }

  return (
    <div className="flex items-center flex-shrink-0 border border-gray-300 rounded overflow-hidden">
      <button
        type="button"
        title="Decrease font size"
        onMouseDown={(e) => { e.preventDefault(); step(-1) }}
        className="px-1.5 py-1 text-sm bg-white text-gray-600 hover:bg-gray-50 select-none leading-none border-r border-gray-300"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={inputVal}
        placeholder="—"
        onChange={(e) => setInputVal(e.target.value)}
        onFocus={() => { isFocused.current = true }}
        onBlur={(e) => { isFocused.current = false; apply(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter')     { apply(inputVal); e.currentTarget.blur() }
          if (e.key === 'ArrowUp')   { e.preventDefault(); step(1) }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(-1) }
        }}
        className="w-9 text-center text-sm text-gray-700 bg-white outline-none py-1"
      />
      <button
        type="button"
        title="Increase font size"
        onMouseDown={(e) => { e.preventDefault(); step(1) }}
        className="px-1.5 py-1 text-sm bg-white text-gray-600 hover:bg-gray-50 select-none leading-none border-l border-gray-300"
      >
        +
      </button>
    </div>
  )
}

// ─── Alignment dropdown ───────────────────────────────────────────────────────

const ALIGNMENTS = [
  { value: 'left',    icon: <LuAlignLeft size={14} />,    label: 'Align left'   },
  { value: 'center',  icon: <LuAlignCenter size={14} />,  label: 'Align center' },
  { value: 'right',   icon: <LuAlignRight size={14} />,   label: 'Align right'  },
  { value: 'justify', icon: <LuAlignJustify size={14} />, label: 'Justify'      },
]

function AlignMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (ev: MouseEvent) => {
      if (
        !triggerRef.current?.contains(ev.target as Node) &&
        !panelRef.current?.contains(ev.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = ALIGNMENTS.find(a => editor.isActive({ textAlign: a.value })) ?? ALIGNMENTS[0]

  const toggle = (ev: React.MouseEvent) => {
    ev.preventDefault()
    if (!open) setRect(triggerRef.current?.getBoundingClientRect() ?? null)
    setOpen(o => !o)
  }

  return (
    <div className="flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title="Text alignment"
        onMouseDown={toggle}
        className="px-2 py-1 text-sm rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-0.5"
      >
        {current.icon}
        <LuChevronDown size={12} className="opacity-60 flex-shrink-0 ml-0.5" />
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded shadow-md py-1"
        >
          {ALIGNMENTS.map(({ value, icon, label }) => (
            <button
              key={value}
              type="button"
              title={label}
              onMouseDown={(ev) => {
                ev.preventDefault()
                editor.chain().focus().setTextAlign(value).run()
                setOpen(false)
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 whitespace-nowrap ${editor.isActive({ textAlign: value }) ? 'bg-gray-100' : ''}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Table dropdown ───────────────────────────────────────────────────────────

const GRID_COLS = 10
const GRID_ROWS = 8

function TableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (ev: MouseEvent) => {
      if (
        !triggerRef.current?.contains(ev.target as Node) &&
        !panelRef.current?.contains(ev.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const inTable = editor.isActive('table')

  const toggle = (ev: React.MouseEvent) => {
    ev.preventDefault()
    if (!open) setRect(triggerRef.current?.getBoundingClientRect() ?? null)
    setOpen(o => !o)
  }

  const insert = (cols: number, rows: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    setOpen(false)
    setHover(null)
  }

  return (
    <div className="flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title="Table"
        onMouseDown={toggle}
        className={`px-2 py-1 text-sm rounded border inline-flex items-center justify-center ${
          inTable
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <LuTable size={14} />
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded shadow-md p-2.5 select-none"
        >
          <div className="flex flex-col gap-1" onMouseLeave={() => setHover(null)}>
            {Array.from({ length: GRID_ROWS }, (_, row) => (
              <div key={row} className="flex gap-1">
                {Array.from({ length: GRID_COLS }, (_, col) => {
                  const isActive = hover !== null && col <= hover.col && row <= hover.row
                  return (
                    <div
                      key={col}
                      className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-blue-100 border-blue-400'
                          : 'bg-white border-gray-300 hover:border-gray-400'
                      }`}
                      onMouseEnter={() => setHover({ col, row })}
                      onMouseDown={(ev) => { ev.preventDefault(); insert(col + 1, row + 1) }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-gray-500 mt-2 h-4">
            {hover ? `${hover.col + 1} × ${hover.row + 1}` : ''}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

export function EditorToolbar({ editor }: Props) {
  const highlightInputRef  = useRef<HTMLInputElement>(null)
  const textColorInputRef  = useRef<HTMLInputElement>(null)
  const [highlightColor, setHighlightColor] = useState('#fef08a')
  const [textColor,      setTextColor]      = useState('#000000')
  const showSearch  = useEditorStore((s) => s.showSearch)
  const toggleSearch = useEditorStore((s) => s.toggleSearch)

  // Subscribe to editor state so button active/disabled states update immediately
  // on every transaction (content change or selection change).
  useEditorState({ editor, selector: ({ editor: e }) => e?.state })

  if (!editor) return null

  const e = editor

  const setLink = () => {
    const prev = e.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      e.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      e.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const insertImage = () => {
    const url = window.prompt('Image URL')
    if (url) e.chain().focus().setImage({ src: url }).run()
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap overflow-x-auto">

      {/* History */}
      <Btn label={<LuUndo2 size={14} />} title="Undo (Ctrl+Z)"       disabled={!e.can().undo()} onClick={() => e.chain().focus().undo().run()} />
      <Btn label={<LuRedo2 size={14} />} title="Redo (Ctrl+Shift+Z)" disabled={!e.can().redo()} onClick={() => e.chain().focus().redo().run()} />

      <Divider />

      {/* Text style */}
      <TextStyleMenu editor={e} />

      <Divider />

      {/* Font size */}
      <FontSizeControl editor={e} />

      <Divider />

      {/* Inline marks */}
      <Btn label={<LuBold size={14} />}          title="Bold (Ctrl+B)"      active={e.isActive('bold')}        onClick={() => e.chain().focus().toggleBold().run()} />
      <Btn label={<LuItalic size={14} />}        title="Italic (Ctrl+I)"    active={e.isActive('italic')}      onClick={() => e.chain().focus().toggleItalic().run()} />
      <Btn label={<LuUnderline size={14} />}     title="Underline (Ctrl+U)" active={e.isActive('underline')}   onClick={() => e.chain().focus().toggleUnderline().run()} />
      <Btn label={<LuStrikethrough size={14} />} title="Strikethrough"      active={e.isActive('strike')}      onClick={() => e.chain().focus().toggleStrike().run()} />
      <div className="relative flex-shrink-0">
        <button
          type="button"
          title="Highlight color"
          onMouseDown={(ev) => { ev.preventDefault(); highlightInputRef.current?.click() }}
          className={`px-2 py-1 text-sm rounded border inline-flex flex-col items-center ${e.isActive('highlight') ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
        >
          <LuHighlighter size={14} />
          <div style={{ backgroundColor: highlightColor }} className="w-full h-0.5 rounded-sm mt-0.5" />
        </button>
        <input
          ref={highlightInputRef}
          type="color"
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          value={highlightColor}
          onChange={(ev) => { setHighlightColor(ev.target.value); e.chain().focus().toggleHighlight({ color: ev.target.value }).run() }}
        />
      </div>
      <div className="relative flex-shrink-0">
        <button
          type="button"
          title="Text color"
          onMouseDown={(ev) => { ev.preventDefault(); textColorInputRef.current?.click() }}
          className="px-2 py-1 text-sm rounded border inline-flex flex-col items-center bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          <LuType size={14} />
          <div style={{ backgroundColor: textColor }} className="w-full h-0.5 rounded-sm mt-0.5" />
        </button>
        <input
          ref={textColorInputRef}
          type="color"
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          value={textColor}
          onChange={(ev) => { setTextColor(ev.target.value); e.chain().focus().setColor(ev.target.value).run() }}
        />
      </div>
      <Btn label={<LuSubscript size={14} />}   title="Subscript"   active={e.isActive('subscript')}   onClick={() => e.chain().focus().toggleSubscript().run()} />
      <Btn label={<LuSuperscript size={14} />} title="Superscript" active={e.isActive('superscript')} onClick={() => e.chain().focus().toggleSuperscript().run()} />

      <Divider />

      {/* Alignment */}
      <AlignMenu editor={e} />

      <Divider />

      {/* Block wrappers */}
      <Btn label={<LuList size={14} />}        title="Bullet list"  active={e.isActive('bulletList')}  onClick={() => e.chain().focus().toggleBulletList().run()} />
      <Btn label={<LuListOrdered size={14} />} title="Ordered list" active={e.isActive('orderedList')} onClick={() => e.chain().focus().toggleOrderedList().run()} />
      <Btn label={<LuQuote size={14} />}       title="Blockquote"   active={e.isActive('blockquote')}  onClick={() => e.chain().focus().toggleBlockquote().run()} />

      <Divider />

      {/* Code */}
      <Btn label={<LuCode size={14} />} title="Code block" active={e.isActive('codeBlock')} onClick={() => e.chain().focus().toggleCodeBlock().run()} />

      <Divider />

      {/* Insert */}
      <Btn label={<LuLink size={14} />}   title="Set link"    active={e.isActive('link')}     onClick={setLink} />
      <Btn label={<LuUnlink size={14} />} title="Remove link" disabled={!e.isActive('link')} onClick={() => e.chain().focus().unsetLink().run()} />
      <Btn label={<LuImage size={14} />}  title="Insert image"                                onClick={insertImage} />

      <Divider />

      {/* Table */}
      <TableMenu editor={e} />

      <Divider />

      {/* Search */}
      <Btn
        label={<LuSearch size={14} />}
        title="Search manuscript (Ctrl+Shift+F)"
        active={showSearch}
        onClick={toggleSearch}
      />

    </div>
  )
}
