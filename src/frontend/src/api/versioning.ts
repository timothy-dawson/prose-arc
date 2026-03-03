import { apiClient } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotRead {
  id: string
  project_id: string
  binder_node_id: string | null
  name: string | null
  snapshot_type: string
  word_count: number
  is_keyframe: boolean
  created_at: string
  updated_at: string
}

export interface SnapshotDiffResponse {
  snapshot_id: string
  compare_to_id: string | null
  additions: string[]
  deletions: string[]
  changes_count: number
}

export interface SnapshotRestoreResponse {
  restored_snapshot_id: string
  word_count: number
  pre_restore_snapshot_id: string | null
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const versioningApi = {
  getHistory: (projectId: string, nodeId: string) =>
    apiClient
      .get<SnapshotRead[]>(`/projects/${projectId}/documents/${nodeId}/history`)
      .then((r) => r.data),

  list: (projectId: string, nodeId?: string) =>
    apiClient
      .get<SnapshotRead[]>(`/projects/${projectId}/snapshots`, {
        params: nodeId ? { binder_node_id: nodeId } : undefined,
      })
      .then((r) => r.data),

  get: (projectId: string, snapshotId: string) =>
    apiClient
      .get<SnapshotRead>(`/projects/${projectId}/snapshots/${snapshotId}`)
      .then((r) => r.data),

  create: (projectId: string, data: { binder_node_id?: string; name?: string }) =>
    apiClient
      .post<SnapshotRead>(`/projects/${projectId}/snapshots`, data)
      .then((r) => r.data),

  restore: (projectId: string, snapshotId: string) =>
    apiClient
      .post<SnapshotRestoreResponse>(
        `/projects/${projectId}/snapshots/${snapshotId}/restore`,
      )
      .then((r) => r.data),

  diff: (projectId: string, snapshotId: string, compareTo?: string) =>
    apiClient
      .get<SnapshotDiffResponse>(`/projects/${projectId}/snapshots/${snapshotId}/diff`, {
        params: compareTo ? { compare_to: compareTo } : undefined,
      })
      .then((r) => r.data),

  delete: (projectId: string, snapshotId: string) =>
    apiClient.delete(`/projects/${projectId}/snapshots/${snapshotId}`),
}
