import { LuCheck, LuCreditCard, LuZap, LuStar, LuRocket } from 'react-icons/lu'
import { useSubscription, useCheckout, useBillingPortal } from '@/hooks/useBilling'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: null,
    period: null,
    description: 'Get started with the basics',
    icon: LuStar,
    features: [
      'Up to 3 projects',
      'Basic editor',
      'Codex (up to 50 entries)',
      'Export to DOCX',
      '1 GB storage',
    ],
  },
  {
    id: 'core',
    name: 'Core',
    price: '$79',
    period: 'one-time',
    description: 'Everything you need to write and publish',
    icon: LuCreditCard,
    features: [
      'Unlimited projects',
      'Full editor (all formatting)',
      'Unlimited Codex entries',
      'Export to DOCX, PDF & ePub',
      'Version history (unlimited)',
      'Writing goals & streaks',
      'Focus mode',
      '10 GB storage',
    ],
  },
  {
    id: 'ai_starter',
    name: 'AI Starter',
    price: '$9.99',
    period: '/month',
    description: 'Core + AI assistance for everyday writers',
    icon: LuZap,
    features: [
      'Everything in Core',
      '50 AI completions / month',
      'AI chapter summaries',
      'Style analysis',
      'Writing suggestions',
    ],
  },
  {
    id: 'ai_pro',
    name: 'AI Pro',
    price: '$19.99',
    period: '/month',
    description: 'Unlimited AI for power users',
    icon: LuRocket,
    features: [
      'Everything in AI Starter',
      'Unlimited AI completions',
      'Prose rewriting',
      'Plot consistency checker',
      'Character voice matching',
      'Priority support',
    ],
  },
]

const PLAN_ORDER = ['free', 'core', 'ai_starter', 'ai_pro']

function planIndex(plan: string) {
  return PLAN_ORDER.indexOf(plan)
}

export function BillingPage() {
  const { data: subscription, isLoading } = useSubscription()
  const checkout = useCheckout()
  const portal = useBillingPortal()

  const currentPlan = subscription?.plan ?? 'free'
  const currentStatus = subscription?.status ?? 'active'

  const statusColor =
    currentStatus === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : currentStatus === 'past_due'
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing & Subscription</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your plan and payment details.</p>
      </div>

      {/* Current plan summary */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-8 flex items-center justify-between gap-4">
        {isLoading ? (
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {PLANS.find((p) => p.id === currentPlan)?.name ?? 'Free'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                  {currentStatus}
                </span>
              </div>
              {subscription?.expires_at && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Renews {new Date(subscription.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            {(currentPlan === 'ai_starter' || currentPlan === 'ai_pro') && (
              <button
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50"
              >
                {portal.isPending ? 'Loading…' : 'Manage Subscription'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isUpgrade = planIndex(plan.id) > planIndex(currentPlan)
          const Icon = plan.icon

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border transition-shadow ${
                isCurrent
                  ? 'border-blue-500 ring-1 ring-blue-500 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Current
                </div>
              )}
              <div className="p-5 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                </div>
                <div className="mb-3">
                  {plan.price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plan.price}</span>
                      {plan.period && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">{plan.period}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">Free</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>
                <ul className="space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <LuCheck size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5 pt-0">
                {isCurrent ? (
                  <div className="w-full py-2 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                    Your current plan
                  </div>
                ) : isUpgrade ? (
                  <button
                    onClick={() => checkout.mutate(plan.id as 'core' | 'ai_starter' | 'ai_pro')}
                    disabled={checkout.isPending}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {checkout.isPending ? 'Loading…' : plan.id === 'core' ? 'Purchase' : 'Subscribe'}
                  </button>
                ) : (
                  <div className="w-full py-2 text-center text-xs text-gray-400 dark:text-gray-500">
                    Included in your plan
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature matrix */}
      <div className="mt-10">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Feature Comparison</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className={`px-4 py-3 font-semibold text-center ${p.id === currentPlan ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {[
                { label: 'Projects', values: ['3', '∞', '∞', '∞'] },
                { label: 'Export formats', values: ['DOCX', 'DOCX, PDF, ePub', 'DOCX, PDF, ePub', 'DOCX, PDF, ePub'] },
                { label: 'Version history', values: ['7 days', '∞', '∞', '∞'] },
                { label: 'AI completions', values: ['—', '—', '50/month', '∞'] },
                { label: 'Storage', values: ['1 GB', '10 GB', '10 GB', '25 GB'] },
                { label: 'Priority support', values: [false, false, false, true] },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{row.label}</td>
                  {row.values.map((val, i) => (
                    <td key={i} className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">
                      {typeof val === 'boolean' ? (
                        val ? (
                          <LuCheck size={16} className="text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )
                      ) : (
                        val
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
