import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { codexApi, type CodexEntryRead, type EntryType, type LinkType } from '@/api/codex'

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export function useCodexEntries(
  projectId: string | null,
  filters?: { entry_type?: EntryType; search?: string },
) {
  return useQuery({
    queryKey: ['codex', projectId, filters],
    queryFn: () => codexApi.list(projectId!, filters),
    enabled: !!projectId,
  })
}

export function useCodexEntry(projectId: string | null, entryId: string | null) {
  return useQuery({
    queryKey: ['codex', projectId, entryId],
    queryFn: () => codexApi.get(projectId!, entryId!),
    enabled: !!projectId && !!entryId,
  })
}

export function useCreateCodexEntry(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      entry_type: EntryType
      name: string
      summary?: string
      content?: Record<string, string>
      tags?: string[]
    }) => codexApi.create(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['codex', projectId] }),
  })
}

export function useUpdateCodexEntry(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      entryId,
      data,
    }: {
      entryId: string
      data: Partial<Pick<CodexEntryRead, 'name' | 'summary' | 'content' | 'tags' | 'image_url'>>
    }) => codexApi.update(projectId, entryId, data as Record<string, unknown>),
    onSuccess: (_data, { entryId }) => {
      qc.invalidateQueries({ queryKey: ['codex', projectId] })
      qc.invalidateQueries({ queryKey: ['codex', projectId, entryId] })
    },
  })
}

export function useDeleteCodexEntry(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => codexApi.delete(projectId, entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['codex', projectId] }),
  })
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export function useCodexLinks(projectId: string | null, entryId: string | null) {
  return useQuery({
    queryKey: ['codex-links', entryId],
    queryFn: () => codexApi.getLinks(projectId!, entryId!),
    enabled: !!projectId && !!entryId,
  })
}

export function useCreateCodexLink(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { source_id: string; target_id: string; link_type: LinkType }) =>
      codexApi.createLink(projectId, data),
    onSuccess: (_data, { source_id, target_id }) => {
      qc.invalidateQueries({ queryKey: ['codex-links', source_id] })
      qc.invalidateQueries({ queryKey: ['codex-links', target_id] })
    },
  })
}

export function useDeleteCodexLink(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      codexApi.deleteLink(projectId, sourceId, targetId),
    onSuccess: (_data, { sourceId, targetId }) => {
      qc.invalidateQueries({ queryKey: ['codex-links', sourceId] })
      qc.invalidateQueries({ queryKey: ['codex-links', targetId] })
    },
  })
}

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

export function useCodexMentions(projectId: string | null, entryId: string | null) {
  return useQuery({
    queryKey: ['codex-mentions', entryId],
    queryFn: () => codexApi.getMentions(projectId!, entryId!),
    enabled: !!projectId && !!entryId,
  })
}

export function useSyncCodexMentions(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, entryIds }: { nodeId: string; entryIds: string[] }) =>
      codexApi.syncMentions(projectId, nodeId, entryIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['codex-mentions'] }),
  })
}

// ---------------------------------------------------------------------------
// Image upload
// ---------------------------------------------------------------------------

export function useUploadCodexImage(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, file }: { entryId: string; file: File }) =>
      codexApi.uploadImage(projectId, entryId, file),
    onSuccess: (_data, { entryId }) => {
      qc.invalidateQueries({ queryKey: ['codex', projectId, entryId] })
      qc.invalidateQueries({ queryKey: ['codex', projectId] })
    },
  })
}
