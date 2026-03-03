import { useRef, useState } from 'react'
import { LuArrowLeft, LuTrash2, LuUpload, LuPlus, LuX } from 'react-icons/lu'
import { useEditorStore } from '@/stores/editorStore'
import {
  useCodexEntry,
  useUpdateCodexEntry,
  useDeleteCodexEntry,
  useCodexLinks,
  useCreateCodexLink,
  useDeleteCodexLink,
  useCodexEntries,
  useUploadCodexImage,
} from '@/hooks/useCodex'
import type { EntryType, LinkType } from '@/api/codex'

// ---------------------------------------------------------------------------
// Field definitions per entry type
// ---------------------------------------------------------------------------

const FIELD_DEFS: Record<EntryType, string[]> = {
  character: ['Role', 'Description', 'Motivation', 'Backstory', 'Appearance', 'Notes'],
  location:  ['Description', 'Geography', 'Significance', 'Notes'],
  item:      ['Description', 'Origin', 'Properties', 'Notes'],
  lore:      ['Category', 'Description', 'Rules', 'Notes'],
  custom:    [],
}

const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: 'related',   label: 'Related' },
  { value: 'parent_of', label: 'Parent of' },
  { value: 'ally',      label: 'Ally' },
  { value: 'enemy',     label: 'Enemy' },
  { value: 'custom',    label: 'Custom' },
]

// ---------------------------------------------------------------------------
// AddLink popup
// ---------------------------------------------------------------------------

function AddLinkPopup({
  projectId,
  entryId,
  onClose,
}: {
  projectId: string
  entryId: string
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkType, setLinkType] = useState<LinkType>('related')
  const { data: entries = [] } = useCodexEntries(projectId, { search: search || undefined })
  const createLink = useCreateCodexLink(projectId)

  const filtered = entries.filter((e) => e.id !== entryId)

  const handleAdd = async () => {
    if (!selectedId) return
    await createLink.mutateAsync({ source_id: entryId, target_id: selectedId, link_type: linkType })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 max-h-96 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-gray-200">Add Link</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><LuX size={14} /></button>
        </div>
        <input
          autoFocus
          type="text"
          placeholder="Search entries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded outline-none focus:border-blue-400"
        />
        <div className="flex-1 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded max-h-40">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedId === e.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'dark:text-gray-300'}`}
            >
              <span className="font-medium">{e.name}</span>
              <span className="ml-1 text-gray-400">({e.entry_type})</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-gray-400 p-2">No entries found</p>}
        </div>
        <select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value as LinkType)}
          className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded outline-none"
        >
          {LINK_TYPES.map((lt) => (
            <option key={lt.value} value={lt.value}>{lt.label}</option>
          ))}
        </select>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedId || createLink.isPending}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Link
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  projectId: string
  entryId: string
}

export function CodexEntryDetail({ projectId, entryId }: Props) {
  const setActiveCodexEntry = useEditorStore((s) => s.setActiveCodexEntry)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAddLink, setShowAddLink] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: entry, isLoading } = useCodexEntry(projectId, entryId)
  const { data: links } = useCodexLinks(projectId, entryId)
  const { data: allEntries = [] } = useCodexEntries(projectId)
  const updateEntry = useUpdateCodexEntry(projectId)
  const deleteEntry = useDeleteCodexEntry(projectId)
  const deleteLink = useDeleteCodexLink(projectId)
  const uploadImage = useUploadCodexImage(projectId)

  if (isLoading || !entry) {
    return <div className="p-4 text-xs text-gray-400 dark:text-gray-500">Loading…</div>
  }

  const fields = FIELD_DEFS[entry.entry_type as EntryType] ?? []

  const handleFieldBlur = (field: string, value: string) => {
    const newContent = { ...entry.content, [field.toLowerCase()]: value }
    updateEntry.mutate({ entryId, data: { content: newContent } })
  }

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = (e.target as HTMLInputElement).value.trim()
      if (val && !entry.tags.includes(val)) {
        updateEntry.mutate({ entryId, data: { tags: [...entry.tags, val] } })
      }
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  const handleTagRemove = (tag: string) => {
    updateEntry.mutate({ entryId, data: { tags: entry.tags.filter((t) => t !== tag) } })
  }

  const handleImageFile = (file: File) => {
    uploadImage.mutate({ entryId, file })
  }

  const handleDelete = async () => {
    await deleteEntry.mutateAsync(entryId)
    setActiveCodexEntry(null)
  }

  const allLinks = [...(links?.outgoing ?? []), ...(links?.incoming ?? [])]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <button
          onClick={() => setActiveCodexEntry(null)}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          title="Back to list"
        >
          <LuArrowLeft size={14} />
        </button>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 capitalize">
          {entry.entry_type}
        </span>
        <div className="flex-1" />
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-400 hover:text-red-500"
            title="Delete entry"
          >
            <LuTrash2 size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-red-500">Delete?</span>
            <button onClick={handleDelete} className="px-2 py-0.5 bg-red-500 text-white rounded text-xs">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded text-xs">No</button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Name */}
        <input
          type="text"
          defaultValue={entry.name}
          onBlur={(e) => updateEntry.mutate({ entryId, data: { name: e.target.value } })}
          className="w-full text-sm font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 outline-none pb-1"
        />

        {/* Summary */}
        <textarea
          defaultValue={entry.summary ?? ''}
          placeholder="Summary…"
          onBlur={(e) => updateEntry.mutate({ entryId, data: { summary: e.target.value } })}
          rows={2}
          className="w-full text-xs text-gray-600 dark:text-gray-400 bg-transparent dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 rounded p-1.5 outline-none resize-none"
        />

        {/* Image */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Image</p>
          {entry.image_url ? (
            <div className="relative group">
              <img
                src={entry.image_url}
                alt={entry.name}
                className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded text-white text-xs"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-16 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
            >
              <LuUpload size={14} />
              <span className="text-xs mt-1">Upload image</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
          />
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Tags</p>
          <div className="flex flex-wrap gap-1 mb-1">
            {entry.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs">
                {tag}
                <button onClick={() => handleTagRemove(tag)} className="hover:text-red-500">
                  <LuX size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add tag, press Enter…"
            onKeyDown={handleTagAdd}
            className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded outline-none focus:border-blue-400"
          />
        </div>

        {/* Dynamic fields */}
        {fields.map((field) => (
          <div key={field}>
            <p className="text-xs font-medium text-gray-500 mb-1">{field}</p>
            <textarea
              key={entry.id + field}
              defaultValue={entry.content[field.toLowerCase()] ?? ''}
              placeholder={`${field}…`}
              onBlur={(e) => handleFieldBlur(field, e.target.value)}
              rows={3}
              className="w-full text-xs text-gray-700 dark:text-gray-300 bg-transparent dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 focus:border-blue-400 rounded p-1.5 outline-none resize-none"
            />
          </div>
        ))}

        {/* Links */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500">Links</p>
            <button
              onClick={() => setShowAddLink(true)}
              className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700"
            >
              <LuPlus size={12} /> Add
            </button>
          </div>
          {allLinks.length === 0 ? (
            <p className="text-xs text-gray-400">No links yet.</p>
          ) : (
            <div className="space-y-1">
              {allLinks.map((link) => {
                const isOut = link.source_id === entryId
                const otherId = isOut ? link.target_id : link.source_id
                return (
                  <div key={`${link.source_id}-${link.target_id}`} className="flex items-center gap-1 text-xs">
                    <span className="text-gray-400">{isOut ? '→' : '←'}</span>
                    <button
                      onClick={() => setActiveCodexEntry(otherId)}
                      className="text-blue-600 hover:underline truncate flex-1 text-left"
                    >
                      {allEntries.find((e) => e.id === otherId)?.name ?? otherId}
                    </button>
                    <span className="text-gray-400 px-1 py-0.5 bg-gray-50 dark:bg-gray-700 rounded capitalize">{link.link_type}</span>
                    <button
                      onClick={() => deleteLink.mutate({ sourceId: link.source_id, targetId: link.target_id })}
                      className="text-gray-300 hover:text-red-400"
                    >
                      <LuX size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showAddLink && (
        <AddLinkPopup
          projectId={projectId}
          entryId={entryId}
          onClose={() => setShowAddLink(false)}
        />
      )}
    </div>
  )
}
