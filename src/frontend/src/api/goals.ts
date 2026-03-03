import { apiClient } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoalRead {
  id: string
  goal_type: 'daily' | 'project' | 'session'
  target_words: number
  project_id: string | null
  deadline: string | null
  created_at: string
  updated_at: string
}

export interface DailyWordCount {
  date: string
  words: number
}

export interface GoalStats {
  words_per_day: DailyWordCount[]
  avg_session_minutes: number
  total_sessions: number
  total_words: number
}

export interface StreakRead {
  current_streak: number
  longest_streak: number
  last_active_date: string | null
}

export interface WritingSessionRead {
  id: string
  project_id: string
  started_at: string
  ended_at: string | null
  words_written: number
  words_deleted: number
  net_words: number
  created_at: string
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const goalsApi = {
  list: () => apiClient.get<GoalRead[]>('/goals').then((r) => r.data),

  create: (data: {
    goal_type: 'daily' | 'project' | 'session'
    target_words: number
    project_id?: string
    deadline?: string
  }) => apiClient.post<GoalRead>('/goals', data).then((r) => r.data),

  update: (id: string, data: { target_words?: number; deadline?: string }) =>
    apiClient.patch<GoalRead>(`/goals/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/goals/${id}`),

  getStats: (range = 30) =>
    apiClient
      .get<GoalStats>('/goals/stats', { params: { range } })
      .then((r) => r.data),

  getStreak: () => apiClient.get<StreakRead>('/goals/streak').then((r) => r.data),

  getTodayProgress: () =>
    apiClient.get<{ words: number }>('/goals/progress/today').then((r) => r.data),

  startSession: (projectId: string) =>
    apiClient
      .post<WritingSessionRead>('/goals/sessions/start', { project_id: projectId })
      .then((r) => r.data),

  endSession: (
    id: string,
    data: { words_written: number; words_deleted: number; net_words: number },
  ) =>
    apiClient
      .post<WritingSessionRead>(`/goals/sessions/${id}/end`, data)
      .then((r) => r.data),
}
