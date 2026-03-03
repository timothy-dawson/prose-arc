import { useState } from 'react'
import { LuPlus, LuSearch, LuUser, LuMapPin, LuSword, LuScroll, LuStar, LuFeather } from 'react-icons/lu'
import { useEditorStore } from '@/stores/editorStore'
import { useCodexEntries, useCreateCodexEntry } from '@/hooks/useCodex'
import type { EntryType } from '@/api/codex'
import { Skeleton } from '@/components/common/Skeleton'

const ENTRY_TYPES: { type: EntryType; label: string; icon: React.ReactNode }[] = [
  { type: 'character', label: 'Characters', icon: <LuUser size={14} /> },
  { type: 'location',  label: 'Locations',  icon: <LuMapPin size={14} /> },
  { type: 'item',      label: 'Items',       icon: <LuSword size={14} /> },
  { type: 'lore',      label: 'Lore',        icon: <LuScroll size={14} /> },
  { type: 'custom',    label: 'Custom',      icon: <LuStar size={14} /> },
]

interface Props {
  projectId: string
}

export function CodexPanel({ projectId }: Props) {
  const [activeType, setActiveType] = useState<EntryType>('character')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const setActiveCodexEntry = useEditorStore((s) => s.setActiveCodexEntry)

  const { data: entries = [], isLoading } = useCodexEntries(projectId, {
    entry_type: activeType,
    search: search || undefined,
  })
  const createEntry = useCreateCodexEntry(projectId)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const entry = await createEntry.mutateAsync({
      entry_type: activeType,
      name: newName.trim(),
    })
    setNewName('')
    setCreating(false)
    setActiveCodexEntry(entry.id)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Type tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {ENTRY_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            title={label}
            onClick={() => { setActiveType(type); setSearch('') }}
            className={`flex-1 py-2 flex items-center justify-center border-b-2 transition-colors ${
              activeType === type
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Search + new button */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="relative flex-1">
          <LuSearch size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded outline-none focus:border-blue-400 bg-white dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-600"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex-shrink-0 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:bg-blue-900/30 rounded"
          title="New entry"
        >
          <LuPlus size={14} />
        </button>
      </div>

      {/* New entry quick-create */}
      {creating && (
        <div className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex gap-1">
          <input
            autoFocus
            type="text"
            placeholder="Entry name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            className="flex-1 px-2 py-1 text-xs border border-blue-400 rounded outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createEntry.isPending}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setCreating(false); setNewName('') }}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
            <LuFeather size={28} className="text-gray-300 dark:text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Start building your world
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                No {ENTRY_TYPES.find((t) => t.type === activeType)?.label.toLowerCase()} yet.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Add one
            </button>
          </div>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setActiveCodexEntry(entry.id)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800 last:border-0"
            >
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{entry.name}</div>
              {entry.summary && (
                <div className="text-xs text-gray-400 truncate mt-0.5">{entry.summary}</div>
              )}
              {entry.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {entry.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
