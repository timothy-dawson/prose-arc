import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  binderApi,
  type BinderNodeRead,
  documentsApi,
  type NodeType,
  projectsApi,
  type ProjectRead,
  searchApi,
} from '@/api/manuscripts'

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string }) => projectsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title?: string }) => projectsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['projects', id] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

// ---------------------------------------------------------------------------
// Binder
// ---------------------------------------------------------------------------

export function useBinder(projectId: string | null) {
  return useQuery({
    queryKey: ['binder', projectId],
    queryFn: () => binderApi.getTree(projectId!),
    enabled: !!projectId,
    select: (data) => data.nodes,
  })
}

export function useCreateBinderNode(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      node_type: NodeType
      title: string
      parent_id?: string
      sort_order?: number
    }) => binderApi.createNode(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binder', projectId] }),
  })
}

export function useUpdateBinderNode(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string
      data: { title?: string; synopsis?: string; parent_id?: string; sort_order?: number }
    }) => binderApi.updateNode(projectId, nodeId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binder', projectId] }),
  })
}

export function useDeleteBinderNode(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodeId: string) => binderApi.deleteNode(projectId, nodeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binder', projectId] }),
  })
}

export function useReorderBinder(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nodes: Array<{ node_id: string; parent_id: string | null; sort_order: number }>) =>
      binderApi.reorder(projectId, nodes),
    onMutate: async (newOrder) => {
      await qc.cancelQueries({ queryKey: ['binder', projectId] })
      const previous = qc.getQueryData<BinderNodeRead[]>(['binder', projectId])
      // Optimistic update: apply new sort_order + parent_id
      if (previous) {
        const updated = previous.map((node) => {
          const item = newOrder.find((o) => o.node_id === node.id)
          return item
            ? { ...node, sort_order: item.sort_order, parent_id: item.parent_id }
            : node
        })
        qc.setQueryData(['binder', projectId], updated)
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['binder', projectId], context.previous)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['binder', projectId] }),
  })
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function useDocument(projectId: string | null, nodeId: string | null) {
  return useQuery({
    queryKey: ['document', nodeId],
    queryFn: () => documentsApi.get(projectId!, nodeId!),
    enabled: !!projectId && !!nodeId,
    staleTime: 0, // always fresh — content may have been saved in another tab
  })
}

export function useSaveDocument(projectId: string, nodeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: Record<string, unknown>) =>
      documentsApi.save(projectId, nodeId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', nodeId] }),
  })
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function useSearch(projectId: string | null, q: string) {
  return useQuery({
    queryKey: ['search', projectId, q],
    queryFn: () => searchApi.search(projectId!, q),
    enabled: !!projectId && q.length > 1,
    staleTime: 30_000,
  })
}
