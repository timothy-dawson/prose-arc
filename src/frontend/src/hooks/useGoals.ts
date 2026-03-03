import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { goalsApi } from '@/api/goals'

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.list(),
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { target_words?: number; deadline?: string } }) =>
      goalsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useStreak() {
  return useQuery({
    queryKey: ['streak'],
    queryFn: () => goalsApi.getStreak(),
  })
}

export function useGoalStats(range = 30) {
  return useQuery({
    queryKey: ['goal-stats', range],
    queryFn: () => goalsApi.getStats(range),
  })
}

export function useTodayProgress() {
  return useQuery({
    queryKey: ['today-progress'],
    queryFn: () => goalsApi.getTodayProgress(),
    refetchInterval: 30_000,
  })
}

export function useStartSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => goalsApi.startSession(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['today-progress'] }),
  })
}

export function useEndSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { words_written: number; words_deleted: number; net_words: number }
    }) => goalsApi.endSession(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-progress'] })
      qc.invalidateQueries({ queryKey: ['streak'] })
      qc.invalidateQueries({ queryKey: ['goal-stats'] })
    },
  })
}
