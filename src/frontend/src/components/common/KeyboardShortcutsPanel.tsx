import { useEffect } from 'react'
import { LuX } from 'react-icons/lu'

interface Shortcut {
  keys: string[]
  description: string
}

interface Group {
  title: string
  shortcuts: Shortcut[]
}

const SHORTCUT_GROUPS: Group[] = [
  {
    title: 'Editor',
    shortcuts: [
      { keys: ['Ctrl', 'B'], description: 'Bold' },
      { keys: ['Ctrl', 'I'], description: 'Italic' },
      { keys: ['Ctrl', 'U'], description: 'Underline' },
      { keys: ['Ctrl', 'Shift', 'X'], description: 'Strikethrough' },
      { keys: ['Ctrl', '`'], description: 'Inline code' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['F11'], description: 'Enter focus mode' },
      { keys: ['Esc'], description: 'Exit focus mode' },
      { keys: ['Ctrl', 'Shift', 'F'], description: 'Search manuscript' },
    ],
  },
  {
    title: 'Binder',
    shortcuts: [
      { keys: ['?'], description: 'Show this panel' },
    ],
  },
]

interface KeyboardShortcutsPanelProps {
  onClose: () => void
}

export function KeyboardShortcutsPanel({ onClose }: KeyboardShortcutsPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuX size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div key={s.description} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key, i) => (
                        <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
