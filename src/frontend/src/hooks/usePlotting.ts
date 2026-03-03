import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { plottingApi, type BeatRead, type TemplateType } from '@/api/plotting'

// ---------------------------------------------------------------------------
// Outlines
// ---------------------------------------------------------------------------

export function useOutlines(projectId: string | null) {
  return useQuery({
    queryKey: ['outlines', projectId],
    queryFn: () => plottingApi.listOutlines(projectId!),
    enabled: !!projectId,
  })
}

export function useCreateOutline(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; template_type: TemplateType }) =>
      plottingApi.createOutline(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outlines', projectId] }),
  })
}

export function useUpdateOutline(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      outlineId,
      data,
    }: {
      outlineId: string
      data: { title?: string; structure?: Record<string, unknown> }
    }) => plottingApi.updateOutline(projectId, outlineId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outlines', projectId] }),
  })
}

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

export function useBeats(projectId: string | null, outlineId: string | null) {
  return useQuery({
    queryKey: ['beats', outlineId],
    queryFn: () => plottingApi.listBeats(projectId!, outlineId!),
    enabled: !!projectId && !!outlineId,
  })
}

export function useCreateBeat(projectId: string, outlineId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      label: string
      description?: string
      act?: number
      sort_order?: number
      binder_node_id?: string
    }) => plottingApi.createBeat(projectId, outlineId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['beats', outlineId] }),
  })
}

export function useUpdateBeat(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      beatId,
      data,
    }: {
      beatId: string
      data: Partial<Pick<BeatRead, 'label' | 'description' | 'act' | 'sort_order' | 'binder_node_id'>>
    }) => plottingApi.updateBeat(projectId, beatId, data),
    onSuccess: (_data, { beatId }) => {
      const beat = _data as BeatRead
      qc.invalidateQueries({ queryKey: ['beats', beat.outline_id] })
    },
  })
}

export function useDeleteBeat(projectId: string, outlineId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (beatId: string) => plottingApi.deleteBeat(projectId, beatId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['beats', outlineId] }),
  })
}

export function useReorderBeats(projectId: string, outlineId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: Array<{ beat_id: string; sort_order: number }>) =>
      plottingApi.reorderBeats(projectId, items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ['beats', outlineId] })
      const previous = qc.getQueryData<BeatRead[]>(['beats', outlineId])
      if (previous) {
        const updated = previous.map((beat) => {
          const item = items.find((i) => i.beat_id === beat.id)
          return item ? { ...beat, sort_order: item.sort_order } : beat
        })
        qc.setQueryData(['beats', outlineId], updated)
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['beats', outlineId], context.previous)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['beats', outlineId] }),
  })
}
