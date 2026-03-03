import { apiClient } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateType = 'three_act' | 'save_the_cat' | 'heros_journey' | 'custom'

export interface OutlineRead {
  id: string
  project_id: string
  title: string
  template_type: TemplateType
  structure: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BeatRead {
  id: string
  outline_id: string
  binder_node_id: string | null
  label: string
  description: string | null
  act: number | null
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const plottingApi = {
  listOutlines: (projectId: string) =>
    apiClient
      .get<OutlineRead[]>(`/projects/${projectId}/outlines`)
      .then((r) => r.data),

  createOutline: (
    projectId: string,
    data: { title: string; template_type: TemplateType; structure?: Record<string, unknown> },
  ) =>
    apiClient
      .post<OutlineRead>(`/projects/${projectId}/outlines`, data)
      .then((r) => r.data),

  updateOutline: (
    projectId: string,
    outlineId: string,
    data: { title?: string; structure?: Record<string, unknown> },
  ) =>
    apiClient
      .patch<OutlineRead>(`/projects/${projectId}/outlines/${outlineId}`, data)
      .then((r) => r.data),

  listBeats: (projectId: string, outlineId: string) =>
    apiClient
      .get<BeatRead[]>(`/projects/${projectId}/outlines/${outlineId}/beats`)
      .then((r) => r.data),

  createBeat: (
    projectId: string,
    outlineId: string,
    data: {
      label: string
      description?: string
      act?: number
      sort_order?: number
      binder_node_id?: string
    },
  ) =>
    apiClient
      .post<BeatRead>(`/projects/${projectId}/outlines/${outlineId}/beats`, data)
      .then((r) => r.data),

  updateBeat: (
    projectId: string,
    beatId: string,
    data: {
      label?: string
      description?: string
      act?: number
      sort_order?: number
      binder_node_id?: string | null
    },
  ) =>
    apiClient
      .patch<BeatRead>(`/projects/${projectId}/beats/${beatId}`, data)
      .then((r) => r.data),

  deleteBeat: (projectId: string, beatId: string) =>
    apiClient.delete(`/projects/${projectId}/beats/${beatId}`),

  reorderBeats: (
    projectId: string,
    items: Array<{ beat_id: string; sort_order: number }>,
  ) =>
    apiClient.post(`/projects/${projectId}/beats/reorder`, { items }),
}
