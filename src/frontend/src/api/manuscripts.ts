import { apiClient } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeType = 'folder' | 'chapter' | 'scene' | 'front_matter' | 'back_matter'

export interface ProjectRead {
  id: string
  owner_id: string
  title: string
  word_count: number
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BinderNodeRead {
  id: string
  project_id: string
  parent_id: string | null
  node_type: NodeType
  title: string
  sort_order: number
  synopsis: string | null
  metadata_: Record<string, unknown>
  word_count: number
  created_at: string
  updated_at: string
  path: string
}

export interface BinderTreeResponse {
  nodes: BinderNodeRead[]
}

export interface DocumentRead {
  binder_node_id: string
  content: Record<string, unknown>
  byte_size: number
  updated_at: string
}

export interface SearchResult {
  node_id: string
  title: string
  snippet: string
  node_type: NodeType
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const projectsApi = {
  list: () => apiClient.get<ProjectRead[]>('/projects').then((r) => r.data),
  create: (data: { title: string; settings?: Record<string, unknown> }) =>
    apiClient.post<ProjectRead>('/projects', data).then((r) => r.data),
  get: (id: string) => apiClient.get<ProjectRead>(`/projects/${id}`).then((r) => r.data),
  update: (id: string, data: { title?: string; settings?: Record<string, unknown> }) =>
    apiClient.patch<ProjectRead>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),
}

export const binderApi = {
  getTree: (projectId: string) =>
    apiClient.get<BinderTreeResponse>(`/projects/${projectId}/binder`).then((r) => r.data),
  createNode: (
    projectId: string,
    data: { node_type: NodeType; title: string; parent_id?: string; sort_order?: number },
  ) =>
    apiClient
      .post<BinderNodeRead>(`/projects/${projectId}/binder`, data)
      .then((r) => r.data),
  updateNode: (
    projectId: string,
    nodeId: string,
    data: { title?: string; synopsis?: string; parent_id?: string; sort_order?: number },
  ) =>
    apiClient
      .patch<BinderNodeRead>(`/projects/${projectId}/binder/${nodeId}`, data)
      .then((r) => r.data),
  deleteNode: (projectId: string, nodeId: string) =>
    apiClient.delete(`/projects/${projectId}/binder/${nodeId}`),
  reorder: (
    projectId: string,
    nodes: Array<{ node_id: string; parent_id: string | null; sort_order: number }>,
  ) => apiClient.post(`/projects/${projectId}/binder/reorder`, { nodes }),
}

export const documentsApi = {
  get: (projectId: string, nodeId: string) =>
    apiClient
      .get<DocumentRead>(`/projects/${projectId}/documents/${nodeId}`)
      .then((r) => r.data),
  save: (projectId: string, nodeId: string, content: Record<string, unknown>) => {
    const bytes = new TextEncoder().encode(JSON.stringify(content)).length
    return apiClient
      .put<DocumentRead>(`/projects/${projectId}/documents/${nodeId}`, {
        content,
        byte_size: bytes,
      })
      .then((r) => r.data)
  },
}

export const searchApi = {
  search: (projectId: string, q: string) =>
    apiClient
      .get<SearchResponse>(`/projects/${projectId}/search`, { params: { q } })
      .then((r) => r.data),
}
