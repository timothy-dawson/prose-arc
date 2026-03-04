import { apiClient } from './client'

export type ExportFormat = 'docx' | 'pdf' | 'epub'
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ExportScope {
  type: 'full' | 'selected'
  node_ids?: string[]
}

export interface ExportCreate {
  format: ExportFormat
  template_id?: string | null
  scope?: ExportScope
}

export interface ExportJobResponse {
  id: string
  project_id: string
  user_id: string
  format: ExportFormat
  template_id: string | null
  scope: ExportScope
  status: ExportStatus
  file_size_bytes: number | null
  error_message: string | null
  expires_at: string | null
  created_at: string
  completed_at: string | null
  download_url: string | null
}

export interface ExportTemplateResponse {
  id: string
  name: string
  format: ExportFormat
  config: Record<string, unknown>
  is_default: boolean
  created_at: string
}

export const exportApi = {
  listTemplates: (format?: ExportFormat) =>
    apiClient
      .get<ExportTemplateResponse[]>('/export/templates', { params: format ? { format } : {} })
      .then((r) => r.data),

  createJob: (projectId: string, data: ExportCreate) =>
    apiClient
      .post<ExportJobResponse>(`/projects/${projectId}/export`, data)
      .then((r) => r.data),

  getJob: (projectId: string, jobId: string) =>
    apiClient
      .get<ExportJobResponse>(`/projects/${projectId}/export/${jobId}`)
      .then((r) => r.data),

  listJobs: (projectId: string, limit = 10) =>
    apiClient
      .get<ExportJobResponse[]>(`/projects/${projectId}/export`, { params: { limit } })
      .then((r) => r.data),
}
