import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'

const feedbackSchema = z.object({
  category: z.enum(['bug', 'feature', 'general']),
  message: z.string().min(10, 'Please write at least 10 characters'),
})

type FeedbackForm = z.infer<typeof feedbackSchema>

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { category: 'general', message: '' },
  })

  const onSubmit = async (data: FeedbackForm) => {
    try {
      await apiClient.post('/feedback', data)
      toast.success('Thanks for your feedback!')
      reset()
      setOpen(false)
    } catch {
      toast.error('Failed to send feedback. Please try again.')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Send feedback"
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M10 2a8 8 0 100 16A8 8 0 0010 2zM7.5 9a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5zm.75 3.75a.75.75 0 01.75-.75h2a.75.75 0 010 1.5h-2a.75.75 0 01-.75-.75zm-.75-6a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-20 right-6 z-50 w-80 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-xl focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Send feedback
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Help us improve Prose Arc.
          </Dialog.Description>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3" noValidate>
            <div>
              <label
                htmlFor="feedback-category"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Category
              </label>
              <select
                {...register('category')}
                id="feedback-category"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="bug">Bug report</option>
                <option value="feature">Feature request</option>
                <option value="general">General feedback</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="feedback-message"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Message
              </label>
              <textarea
                {...register('message')}
                id="feedback-message"
                rows={4}
                className="w-full resize-none rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Tell us what you think…"
              />
              {errors.message && (
                <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {isSubmitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
