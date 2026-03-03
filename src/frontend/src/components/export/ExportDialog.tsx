import { useState } from 'react'
import {
  LuDownload,
  LuFileText,
  LuFileType,
  LuLoader,
  LuRefreshCw,
  LuX,
  LuBook,
} from 'react-icons/lu'
import { toast } from 'sonner'
import type { ExportFormat, ExportJobResponse } from '@/api/export'
import { useCreateExport, useExportHistory, useExportJob, useExportTemplates } from '@/hooks/useExport'
import type { BinderNodeRead } from '@/api/manuscripts'

interface ExportDialogProps {
  projectId: string
  nodes: BinderNodeRead[]
  onClose: () => void
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'docx', label: 'Word Document', description: 'Best for editors and manuscript submission', Icon: LuFileText },
  { value: 'pdf', label: 'PDF', description: 'Best for sharing and print-ready output', Icon: LuFileType },
  { value: 'epub', label: 'ePub', description: 'Best for e-readers and digital publishing', Icon: LuBook },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ExportDialog({ projectId, nodes, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('docx')
  const [templateId, setTemplateId] = useState<string>('')
  const [scopeType, setScopeType] = useState<'full' | 'selected'>('full')
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: templates = [] } = useExportTemplates(format)
  const { data: history = [] } = useExportHistory(projectId)
  const createExport = useCreateExport(projectId)
  const { data: activeJob } = useExportJob(projectId, activeJobId)

  const filteredTemplates = templates.filter((t) => t.format === format)

  const handleSubmit = async () => {
    const job = await createExport.mutateAsync({
      format,
      template_id: templateId || null,
      scope:
        scopeType === 'full'
          ? { type: 'full' }
          : { type: 'selected', node_ids: Array.from(selectedNodeIds) },
    })
    setActiveJobId(job.id)
  }

  const handleDownload = (job: ExportJobResponse) => {
    if (job.download_url) {
      window.open(job.download_url, '_blank')
    }
  }

  const isInFlight = activeJob?.status === 'pending' || activeJob?.status === 'processing'
  const isCompleted = activeJob?.status === 'completed'
  const isFailed = activeJob?.status === 'failed'

  // Chapter/folder nodes for scope selection
  const selectableNodes = nodes.filter(
    (n) => !n.deleted_at && (n.node_type === 'chapter' || n.node_type === 'folder'),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Export Manuscript</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <LuX size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* In-flight / result view */}
          {activeJobId && (
            <div className="text-center py-4">
              {isInFlight && (
                <>
                  <LuLoader size={32} className="animate-spin mx-auto mb-3 text-blue-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {activeJob?.status === 'pending' ? 'Queued…' : 'Rendering your manuscript…'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This may take up to a minute for large documents.</p>
                </>
              )}
              {isCompleted && activeJob && (
                <>
                  <div className="text-green-500 text-3xl mb-3">✓</div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Export ready!</p>
                  {activeJob.file_size_bytes && (
                    <p className="text-xs text-gray-400 mb-3">{formatBytes(activeJob.file_size_bytes)}</p>
                  )}
                  <button
                    onClick={() => handleDownload(activeJob)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
                  >
                    <LuDownload size={14} /> Download {activeJob.format.toUpperCase()}
                  </button>
                </>
              )}
              {isFailed && (
                <>
                  <div className="text-red-500 text-3xl mb-3">✗</div>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-1">Export failed</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{activeJob?.error_message ?? 'An unexpected error occurred.'}</p>
                  <button
                    onClick={() => setActiveJobId(null)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <LuRefreshCw size={13} /> Try Again
                  </button>
                </>
              )}
            </div>
          )}

          {/* Export form (hidden while job is active) */}
          {!activeJobId && (
            <>
              {/* Format selection */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Format</p>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAT_OPTIONS.map(({ value, label, description, Icon }) => (
                    <button
                      key={value}
                      onClick={() => { setFormat(value); setTemplateId('') }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-colors ${
                        format === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium">{label}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template selection */}
              {filteredTemplates.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
                    Template
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default styling</option>
                    {filteredTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Scope */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Scope</p>
                <div className="flex gap-3 mb-3">
                  {(['full', 'selected'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value={type}
                        checked={scopeType === type}
                        onChange={() => setScopeType(type)}
                        className="accent-blue-600"
                      />
                      {type === 'full' ? 'Full manuscript' : 'Selected chapters'}
                    </label>
                  ))}
                </div>
                {scopeType === 'selected' && selectableNodes.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                    {selectableNodes.map((n) => (
                      <label key={n.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                        <input
                          type="checkbox"
                          checked={selectedNodeIds.has(n.id)}
                          onChange={(e) => {
                            const next = new Set(selectedNodeIds)
                            e.target.checked ? next.add(n.id) : next.delete(n.id)
                            setSelectedNodeIds(next)
                          }}
                          className="accent-blue-600"
                        />
                        {n.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Recent exports */}
          {history.length > 0 && !activeJobId && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Recent Exports</p>
              <div className="space-y-1.5">
                {history.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between text-sm px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="uppercase text-xs font-mono text-gray-500 dark:text-gray-400 w-8">{job.format}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        job.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                        job.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                      }`}>
                        {job.status}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">{timeAgo(job.created_at)}</span>
                    </div>
                    {job.status === 'completed' && job.download_url && (
                      <button
                        onClick={() => handleDownload(job)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <LuDownload size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!activeJobId && (
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createExport.isPending || (scopeType === 'selected' && selectedNodeIds.size === 0)}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {createExport.isPending ? 'Exporting…' : `Export as ${format.toUpperCase()}`}
            </button>
          </div>
        )}
        {(isCompleted || isFailed) && (
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
