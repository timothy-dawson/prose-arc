import { useState } from 'react'
import { LuFlame, LuPlus, LuTarget, LuTrash2 } from 'react-icons/lu'
import {
  useCreateGoal,
  useDeleteGoal,
  useGoalStats,
  useGoals,
  useStreak,
  useTodayProgress,
  useUpdateGoal,
} from '@/hooks/useGoals'
import type { GoalRead } from '@/api/goals'

interface GoalsPanelProps {
  projectId: string
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
      <div
        className="bg-blue-500 h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function GoalRow({
  goal,
  todayWords,
  onDelete,
}: {
  goal: GoalRead
  todayWords: number
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState(String(goal.target_words))
  const updateGoal = useUpdateGoal()

  const progress = goal.goal_type === 'daily' ? todayWords : 0
  const label: Record<string, string> = {
    daily: 'Daily',
    project: 'Project',
    session: 'Session',
  }

  const handleSave = () => {
    const n = parseInt(editTarget, 10)
    if (!isNaN(n) && n > 0) {
      updateGoal.mutate({ id: goal.id, data: { target_words: n } })
    }
    setEditing(false)
  }

  return (
    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex-shrink-0">
            {label[goal.goal_type] ?? goal.goal_type}
          </span>
          {editing ? (
            <input
              autoFocus
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="text-xs w-20 border border-blue-400 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 truncate"
              title="Click to edit"
            >
              {goal.target_words.toLocaleString()} words
            </button>
          )}
          {goal.deadline && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
              by {goal.deadline}
            </span>
          )}
        </div>
        <button
          onClick={() => onDelete(goal.id)}
          className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
          title="Delete goal"
        >
          <LuTrash2 size={11} />
        </button>
      </div>
      {goal.goal_type === 'daily' && (
        <>
          <ProgressBar value={progress} max={goal.target_words} />
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            {progress.toLocaleString()} / {goal.target_words.toLocaleString()} today
          </p>
        </>
      )}
    </div>
  )
}

function AddGoalForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [goalType, setGoalType] = useState<'daily' | 'project' | 'session'>('daily')
  const [targetWords, setTargetWords] = useState('1000')
  const [deadline, setDeadline] = useState('')
  const createGoal = useCreateGoal()

  const handleCreate = () => {
    const target = parseInt(targetWords, 10)
    if (isNaN(target) || target <= 0) return
    createGoal.mutate(
      {
        goal_type: goalType,
        target_words: target,
        project_id: goalType === 'project' ? projectId : undefined,
        deadline: deadline || undefined,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="px-3 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 space-y-2">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Add goal</p>
      <div className="flex gap-2">
        <select
          value={goalType}
          onChange={(e) => setGoalType(e.target.value as typeof goalType)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none"
        >
          <option value="daily">Daily</option>
          <option value="project">Project</option>
          <option value="session">Session</option>
        </select>
        <input
          type="number"
          value={targetWords}
          onChange={(e) => setTargetWords(e.target.value)}
          placeholder="Words"
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none w-20"
        />
      </div>
      {goalType === 'project' && (
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none w-full"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={createGoal.isPending}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-500 disabled:opacity-50"
        >
          {createGoal.isPending ? 'Adding…' : 'Add goal'}
        </button>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function GoalsPanel({ projectId }: GoalsPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: goals = [] } = useGoals()
  const { data: todayData } = useTodayProgress()
  const { data: streak } = useStreak()
  const { data: stats } = useGoalStats(7)
  const deleteGoal = useDeleteGoal()

  const todayWords = todayData?.words ?? 0
  const dailyGoal = goals.find((g) => g.goal_type === 'daily')

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <LuTarget size={14} className="text-gray-400 dark:text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Goals</span>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <LuPlus size={12} />
          Add goal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add goal form */}
        {showAddForm && (
          <AddGoalForm projectId={projectId} onClose={() => setShowAddForm(false)} />
        )}

        {/* Goals list */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          {goals.length === 0 && !showAddForm && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
              No goals yet. Click &ldquo;Add goal&rdquo; above.
            </p>
          )}
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              todayWords={todayWords}
              onDelete={(id) => deleteGoal.mutate(id)}
            />
          ))}
        </div>

        {/* Today's progress */}
        <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
            Today&apos;s Progress
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {todayWords.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">words written</span>
          </div>
          {dailyGoal && (
            <>
              <ProgressBar value={todayWords} max={dailyGoal.target_words} />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {Math.min(100, Math.round((todayWords / dailyGoal.target_words) * 100))}% of daily goal
              </p>
            </>
          )}
        </div>

        {/* Streak */}
        {streak && (
          <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Streak</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <LuFlame size={16} className="text-orange-500" />
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {streak.current_streak}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  day{streak.current_streak !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                Longest: {streak.longest_streak} day{streak.longest_streak !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* Mini stats chart (last 7 days) */}
        {stats && (() => {
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            const dateStr = d.toISOString().slice(0, 10)
            const found = stats.words_per_day.find((x) => x.date === dateStr)
            return { date: dateStr, words: found?.words ?? 0 }
          })
          const maxWords = Math.max(...last7.map((d) => d.words), 1)
          return (
          <div className="px-3 py-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
              Last 7 days
            </p>
            <div className="flex items-end gap-1 h-16">
              {last7.map((day) => {
                const pct = Math.round((day.words / maxWords) * 100)
                const label = new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${new Date(day.date + 'T12:00:00').toLocaleDateString()}: ${day.words.toLocaleString()} words`}
                  >
                    <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                      <div
                        className={`w-full rounded-sm transition-all ${day.words > 0 ? 'bg-blue-400 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                        style={{ height: pct > 0 ? `${pct}%` : '2px' }}
                      />
                    </div>
                    <span className="text-[8px] text-gray-400 dark:text-gray-500">{label}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
              {stats.total_sessions} session{stats.total_sessions !== 1 ? 's' : ''} ·{' '}
              {stats.avg_session_minutes > 0
                ? `avg ${stats.avg_session_minutes} min`
                : 'no completed sessions'}
            </p>
          </div>
          )
        })()}
      </div>
    </div>
  )
}
