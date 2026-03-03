import { useState } from 'react'
import { LuClock, LuPlus, LuRotateCcw, LuTrash2, LuX } from 'react-icons/lu'
import { Skeleton } from '@/components/common/Skeleton'
import {
  useCreateSnapshot,
  useDeleteSnapshot,
  useDocumentHistory,
  useRestoreSnapshot,
  useSnapshotDiff,
} from '@/hooks/useVersioning'
import type { SnapshotRead } from '@/api/versioning'

interface VersionHistoryPanelProps {
  projectId: string
  nodeId: string
}

function SnapshotBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    auto: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    manual: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    pre_restore: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  }
  const label: Record<string, string> = {
    auto: 'Auto',
    manual: 'Manual',
    pre_restore: 'Pre-restore',
    pre_ai: 'Pre-AI',
    branch_point: 'Branch',
  }
  const cls = colors[type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {label[type] ?? type}
    </span>
  )
}

function DiffViewer({
  projectId,
  snapshotId,
}: {
  projectId: string
  snapshotId: string
}) {
  const { data: diff, isLoading } = useSnapshotDiff(projectId, snapshotId)

  if (isLoading) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 p-3">Loading diff…</p>
  }
  if (!diff) return null

  if (diff.changes_count === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 p-3">
        No differences from current document.
      </p>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {diff.changes_count} change{diff.changes_count !== 1 ? 's' : ''} vs current
      </p>
      {diff.additions.length > 0 && (
        <div>
          <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold mb-1">
            + Added ({diff.additions.length})
          </p>
          <div className="space-y-1">
            {diff.additions.slice(0, 10).map((line, i) => (
              <div
                key={i}
                className="text-xs bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-2 py-1 rounded line-clamp-2"
              >
                + {line}
              </div>
            ))}
          </div>
        </div>
      )}
      {diff.deletions.length > 0 && (
        <div>
          <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold mb-1">
            − Removed ({diff.deletions.length})
          </p>
          <div className="space-y-1">
            {diff.deletions.slice(0, 10).map((line, i) => (
              <div
                key={i}
                className="text-xs bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 px-2 py-1 rounded line-clamp-2"
              >
                − {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function VersionHistoryPanel({ projectId, nodeId }: VersionHistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)

  const { data: snapshots = [], isLoading } = useDocumentHistory(projectId, nodeId)
  const createSnapshot = useCreateSnapshot(projectId)
  const restoreSnapshot = useRestoreSnapshot(projectId)
  const deleteSnapshot = useDeleteSnapshot(projectId)

  const handleCreate = () => {
    createSnapshot.mutate(
      { binder_node_id: nodeId, name: snapshotName || undefined },
      {
        onSuccess: () => {
          setShowNameInput(false)
          setSnapshotName('')
        },
      },
    )
  }

  const handleRestore = (snap: SnapshotRead) => {
    restoreSnapshot.mutate(snap.id, {
      onSuccess: () => setConfirmRestoreId(null),
    })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <LuClock size={14} className="text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Version History
          </span>
        </div>
        <button
          onClick={() => setShowNameInput((v) => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          title="Save a named snapshot"
        >
          <LuPlus size={12} />
          Save snapshot
        </button>
      </div>

      {/* Name input */}
      {showNameInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <input
            autoFocus
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setShowNameInput(false)
            }}
            placeholder="Snapshot name (optional)"
            className="flex-1 text-xs outline-none bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400"
          />
          <button
            onClick={handleCreate}
            disabled={createSnapshot.isPending}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-500 disabled:opacity-50"
          >
            {createSnapshot.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setShowNameInput(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuX size={12} />
          </button>
        </div>
      )}

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
        {!isLoading && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
            <LuClock size={28} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No version history yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Your version history will appear here.</p>
          </div>
        )}
        {snapshots.map((snap) => {
          const isSelected = selectedId === snap.id
          const createdAt = new Date(snap.created_at)
          return (
            <div key={snap.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
              <button
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => setSelectedId(isSelected ? null : snap.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <SnapshotBadge type={snap.snapshot_type} />
                    <span className="text-xs text-gray-800 dark:text-gray-200 truncate">
                      {snap.name ?? 'Auto-saved'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {snap.word_count.toLocaleString()} w
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                  {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>

              {/* Expanded diff + actions */}
              {isSelected && (
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <DiffViewer projectId={projectId} snapshotId={snap.id} />

                  {/* Actions */}
                  <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-700">
                    {confirmRestoreId === snap.id ? (
                      <>
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex-1">
                          Restore to this version?
                        </span>
                        <button
                          onClick={() => handleRestore(snap)}
                          disabled={restoreSnapshot.isPending}
                          className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-500 disabled:opacity-50"
                        >
                          {restoreSnapshot.isPending ? 'Restoring…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmRestoreId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmRestoreId(snap.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <LuRotateCcw size={11} />
                          Restore
                        </button>
                        <button
                          onClick={() => deleteSnapshot.mutate(snap.id)}
                          disabled={deleteSnapshot.isPending}
                          className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:underline ml-auto disabled:opacity-50"
                        >
                          <LuTrash2 size={11} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
