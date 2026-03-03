import { useEffect, useRef, useState } from 'react'
import { LuTrash2, LuX } from 'react-icons/lu'

interface DeleteConfirmDialogProps {
  open: boolean
  itemName: string
  itemType: string
  expiryDays?: number
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export function DeleteConfirmDialog({
  open,
  itemName,
  itemType,
  expiryDays = 30,
  onConfirm,
  onCancel,
  isPending = false,
}: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmed = typed === 'delete'

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (open) {
      setTyped('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard: Escape → cancel, Enter (when valid) → confirm
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && confirmed && !isPending) onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, confirmed, isPending, onConfirm, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <LuTrash2 size={15} className="text-red-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Delete {itemType}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuX size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">&ldquo;{itemName}&rdquo;</span> will be moved to trash
            and permanently deleted in <span className="font-medium">{expiryDays} days</span>.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Type <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">delete</span> to confirm:
            </label>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="delete"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-red-400 dark:focus:border-red-500 placeholder-gray-300 dark:placeholder-gray-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 pb-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <LuTrash2 size={12} />
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
