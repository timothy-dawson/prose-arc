import { useEffect, useState } from 'react'
import { Joyride, type CallBackProps, STATUS, type Step } from 'react-joyride'

export const TOUR_PENDING_KEY = 'prose-arc-tour-pending'
export const TOUR_COMPLETE_KEY = 'prose-arc-tour-complete'
export const REPLAY_TOUR_EVENT = 'prose-arc:replay-tour'

const STEPS: Step[] = [
  {
    target: '[data-tour="binder"]',
    content: 'Organize your chapters and scenes here. Drag to reorder.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="codex"]',
    content: 'Build your world: characters, locations, items, and lore.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="editor"]',
    content: 'Write here. Changes auto-save every 3 seconds.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="kanban"]',
    content: 'Switch to Kanban view to manage scene status and plot flow.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="version-history"]',
    content: 'Snapshots of your work. Restore any previous version.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="goals"]',
    content: 'Set daily word count targets and track your streaks.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="focus-mode"]',
    content: 'Press F11 for distraction-free writing.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="export"]',
    content: "When you're ready, export to DOCX, PDF, or ePub.",
    disableBeacon: true,
  },
]

export function FeatureTour() {
  const [run, setRun] = useState(() => localStorage.getItem(TOUR_PENDING_KEY) === 'true')
  const [tourKey, setTourKey] = useState(0)

  useEffect(() => {
    const handler = () => {
      localStorage.setItem(TOUR_PENDING_KEY, 'true')
      localStorage.removeItem(TOUR_COMPLETE_KEY)
      setTourKey((k) => k + 1)
      setRun(true)
    }
    window.addEventListener(REPLAY_TOUR_EVENT, handler)
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, handler)
  }, [])

  const handleCallback = (data: CallBackProps) => {
    const { status } = data
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.removeItem(TOUR_PENDING_KEY)
      localStorage.setItem(TOUR_COMPLETE_KEY, 'true')
      setRun(false)
    }
  }

  return (
    <Joyride
      key={tourKey}
      steps={STEPS}
      run={run}
      continuous
      disableScrolling
      showSkipButton
      showProgress
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: '#2563eb',
          zIndex: 10000,
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  )
}
