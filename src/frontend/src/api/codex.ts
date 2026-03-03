import { apiClient } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntryType = 'character' | 'location' | 'item' | 'lore' | 'custom'
export type LinkType = 'related' | 'parent_of' | 'ally' | 'enemy' | 'custom'

export interface CodexEntryRead {
  id: string
  project_id: string
  entry_type: EntryType
  name: string
  summary: string | null
  content: Record<string, string>
  tags: string[]
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface CodexLinkRead {
  source_id: string
  target_id: string
  link_type: LinkType
  metadata: Record<string, unknown>
}

export interface CodexLinksResponse {
  outgoing: CodexLinkRead[]
  incoming: CodexLinkRead[]
}

export interface CodexMentionRead {
  binder_node_id: string
  codex_entry_id: string
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const codexApi = {
  list: (
    projectId: string,
    params?: { entry_type?: EntryType; search?: string; tags?: string[] },
  ) =>
    apiClient
      .get<CodexEntryRead[]>(`/projects/${projectId}/codex`, { params })
      .then((r) => r.data),

  create: (
    projectId: string,
    data: {
      entry_type: EntryType
      name: string
      summary?: string
      content?: Record<string, string>
      tags?: string[]
    },
  ) =>
    apiClient
      .post<CodexEntryRead>(`/projects/${projectId}/codex`, data)
      .then((r) => r.data),

  get: (projectId: string, entryId: string) =>
    apiClient
      .get<CodexEntryRead>(`/projects/${projectId}/codex/${entryId}`)
      .then((r) => r.data),

  update: (
    projectId: string,
    entryId: string,
    data: {
      name?: string
      summary?: string
      content?: Record<string, string>
      tags?: string[]
      image_url?: string
    },
  ) =>
    apiClient
      .patch<CodexEntryRead>(`/projects/${projectId}/codex/${entryId}`, data)
      .then((r) => r.data),

  delete: (projectId: string, entryId: string) =>
    apiClient.delete(`/projects/${projectId}/codex/${entryId}`),

  // Links
  getLinks: (projectId: string, entryId: string) =>
    apiClient
      .get<CodexLinksResponse>(`/projects/${projectId}/codex/${entryId}/links`)
      .then((r) => r.data),

  createLink: (
    projectId: string,
    data: { source_id: string; target_id: string; link_type: LinkType },
  ) =>
    apiClient
      .post<CodexLinkRead>(`/projects/${projectId}/codex/links`, data)
      .then((r) => r.data),

  deleteLink: (projectId: string, sourceId: string, targetId: string) =>
    apiClient.delete(`/projects/${projectId}/codex/links/${sourceId}/${targetId}`),

  // Mentions
  getMentions: (projectId: string, entryId: string) =>
    apiClient
      .get<CodexMentionRead[]>(`/projects/${projectId}/codex/${entryId}/mentions`)
      .then((r) => r.data),

  syncMentions: (projectId: string, nodeId: string, entryIds: string[]) =>
    apiClient.put(`/projects/${projectId}/binder/${nodeId}/mentions`, {
      entry_ids: entryIds,
    }),

  // Image upload
  uploadImage: (projectId: string, entryId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient
      .post<{ image_url: string }>(`/projects/${projectId}/codex/${entryId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}
