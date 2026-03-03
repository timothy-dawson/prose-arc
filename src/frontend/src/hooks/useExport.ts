import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExportCreate, exportApi } from '@/api/export'
import type { ExportFormat } from '@/api/export'

export function useExportTemplates(format?: ExportFormat) {
  return useQuery({
    queryKey: ['export-templates', format ?? 'all'],
    queryFn: () => exportApi.listTemplates(format),
    staleTime: 5 * 60 * 1000, // 5 min — templates rarely change
  })
}

export function useCreateExport(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExportCreate) => exportApi.createJob(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['export-jobs', projectId] })
    },
  })
}

export function useExportJob(projectId: string, jobId: string | null) {
  return useQuery({
    queryKey: ['export-job', projectId, jobId],
    queryFn: () => exportApi.getJob(projectId, jobId!),
    enabled: !!jobId,
    // Poll every 2s while job is in-flight, stop when done
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'processing' ? 2000 : false
    },
  })
}

export function useExportHistory(projectId: string) {
  return useQuery({
    queryKey: ['export-jobs', projectId],
    queryFn: () => exportApi.listJobs(projectId, 10),
    staleTime: 30_000,
  })
}
