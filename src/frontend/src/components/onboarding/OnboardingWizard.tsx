import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateProject, useCreateSampleProject } from '@/hooks/useManuscript'

const ONBOARDING_KEY = 'prose-arc-onboarding'
const TOUR_PENDING_KEY = 'prose-arc-tour-pending'

const step2Schema = z.object({
  title: z.string().min(1, 'Project name is required').max(255),
  genre: z.enum(['fiction', 'nonfiction', 'other']),
})
type Step2Form = z.infer<typeof step2Schema>

interface Props {
  open: boolean
  onClose: () => void
}

export function OnboardingWizard({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [structure, setStructure] = useState<'blank' | 'sample'>('blank')
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const createProject = useCreateProject()
  const createSampleProject = useCreateSampleProject()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: { genre: 'fiction' },
  })

  const title = watch('title')

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'complete')
    onClose()
  }

  const handleStep2Submit = (data: Step2Form) => {
    // Store title for later use; advance to step 3
    void data
    setStep(3)
  }

  const handleFinish = async () => {
    const titleValue = (document.getElementById('onboarding-title') as HTMLInputElement | null)?.value
      || 'My Novel'

    let projectId: string
    if (structure === 'sample') {
      const project = await createSampleProject.mutateAsync()
      projectId = project.id
    } else {
      const project = await createProject.mutateAsync({ title: titleValue })
      projectId = project.id
    }

    setCreatedProjectId(projectId)
    setStep(4)
  }

  const handleStartWriting = () => {
    localStorage.setItem(ONBOARDING_KEY, 'complete')
    localStorage.setItem(TOUR_PENDING_KEY, 'true')
    onClose()
    if (createdProjectId) {
      navigate(`/projects/${createdProjectId}`)
    }
  }

  const isPending = createProject.isPending || createSampleProject.isPending

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleSkip()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
            {/* Progress bar */}
            <div className="h-1 bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>

            <div className="p-8">
              {step === 1 && (
                <div className="text-center space-y-4">
                  <div className="text-5xl">✍️</div>
                  <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Welcome to Prose Arc
                  </Dialog.Title>
                  <Dialog.Description className="text-gray-500 dark:text-gray-400">
                    Your all-in-one writing studio. Let's get you set up in just a few steps.
                  </Dialog.Description>
                  <div className="pt-4 flex flex-col gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      Get Started
                    </button>
                    <button
                      onClick={handleSkip}
                      className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <form onSubmit={handleSubmit(handleStep2Submit)} className="space-y-5" noValidate>
                  <div>
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      About your project
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      You can always change these later.
                    </Dialog.Description>
                  </div>

                  <div>
                    <label htmlFor="onboarding-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Project name
                    </label>
                    <input
                      {...register('title')}
                      id="onboarding-title"
                      type="text"
                      placeholder="e.g. The Last Kingdom"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {errors.title && (
                      <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="onboarding-genre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Genre
                    </label>
                    <select
                      {...register('genre')}
                      id="onboarding-genre"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="fiction">Fiction</option>
                      <option value="nonfiction">Non-fiction</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      Back
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      Next
                    </button>
                  </div>
                </form>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Choose your starting point
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      How would you like to begin?
                    </Dialog.Description>
                  </div>

                  <div className="space-y-3">
                    <label
                      className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                        structure === 'blank'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="structure"
                        value="blank"
                        checked={structure === 'blank'}
                        onChange={() => setStructure('blank')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Blank project</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Start with a clean slate. Add chapters as you go.</p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                        structure === 'sample'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="structure"
                        value="sample"
                        checked={structure === 'sample'}
                        onChange={() => setStructure('sample')}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sample project</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Includes demo content — chapters, a scene, and codex entries — so you can explore all features.</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button type="button" onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      Back
                    </button>
                    <button
                      onClick={handleFinish}
                      disabled={isPending}
                      className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {isPending ? 'Creating…' : 'Create Project'}
                    </button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="text-center space-y-4">
                  <div className="text-5xl">🎉</div>
                  <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Your project is ready!
                  </Dialog.Title>
                  <Dialog.Description className="text-gray-500 dark:text-gray-400">
                    We'll give you a quick tour of the editor so you know where everything is.
                  </Dialog.Description>
                  <div className="pt-4">
                    <button
                      onClick={handleStartWriting}
                      className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      Start writing →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step indicator */}
            <div className="px-8 pb-6 flex justify-center gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step ? 'w-6 bg-blue-600' : s < step ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
