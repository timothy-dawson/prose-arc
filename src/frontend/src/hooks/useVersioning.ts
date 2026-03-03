import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { versioningApi } from '@/api/versioning'

export function useDocumentHistory(projectId: string | null, nodeId: string | null) {
  return useQuery({
    queryKey: ['snapshots', projectId, nodeId],
    queryFn: () => versioningApi.getHistory(projectId!, nodeId!),
    enabled: !!projectId && !!nodeId,
  })
}

export function useCreateSnapshot(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { binder_node_id?: string; name?: string }) =>
      versioningApi.create(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snapshots', projectId] }),
  })
}

export function useRestoreSnapshot(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (snapshotId: string) => versioningApi.restore(projectId, snapshotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document'] })
      qc.invalidateQueries({ queryKey: ['snapshots', projectId] })
    },
  })
}

export function useSnapshotDiff(
  projectId: string | null,
  snapshotId: string | null,
  compareTo?: string,
) {
  return useQuery({
    queryKey: ['snapshot-diff', projectId, snapshotId, compareTo],
    queryFn: () => versioningApi.diff(projectId!, snapshotId!, compareTo),
    enabled: !!projectId && !!snapshotId,
  })
}

export function useDeleteSnapshot(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (snapshotId: string) => versioningApi.delete(projectId, snapshotId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snapshots', projectId] }),
  })
}
