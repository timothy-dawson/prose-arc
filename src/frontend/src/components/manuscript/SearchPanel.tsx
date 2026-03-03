import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@/hooks/useManuscript'
import { useEditorStore } from '@/stores/editorStore'
import type { NodeType } from '@/api/manuscripts'

interface SearchPanelProps {
  projectId: string
  onClose: () => void
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  folder: 'Folder',
  chapter: 'Chapter',
  scene: 'Scene',
  front_matter: 'Front Matter',
  back_matter: 'Back Matter',
}

export function SearchPanel({ projectId, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const setCurrentNode = useEditorStore((s) => s.setCurrentNode)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Ctrl+Shift+F or Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { data, isFetching } = useSearch(projectId, debouncedQuery)
  const results = data?.results ?? []

  return (
    <div className="flex flex-col h-full border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Search input */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-gray-400 dark:text-gray-500 text-sm">🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search manuscript…"
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600"
        />
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          title="Close search (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isFetching && debouncedQuery.length > 1 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">Searching…</p>
        )}
        {!isFetching && debouncedQuery.length > 1 && results.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No results</p>
        )}
        {results.map((result) => (
          <button
            key={result.node_id}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0"
            onClick={() => {
              setCurrentNode(result.node_id)
              onClose()
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium truncate text-gray-800 dark:text-gray-200">{result.title}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 bg-gray-100 dark:bg-gray-700 px-1 rounded">
                {NODE_TYPE_LABELS[result.node_type]}
              </span>
            </div>
            {result.snippet && (
              <p
                className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2"
                dangerouslySetInnerHTML={{ __html: result.snippet }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
