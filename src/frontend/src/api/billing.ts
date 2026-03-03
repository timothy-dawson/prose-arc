import apiClient from './client'

export type PlanName = 'free' | 'core' | 'ai_starter' | 'ai_pro'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'expired'

export interface SubscriptionResponse {
  id: string | null
  user_id: string
  plan: PlanName
  status: SubscriptionStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  purchased_at: string | null
  expires_at: string | null
}

export interface CheckoutResponse {
  url: string
  session_id: string | null
}

export interface BillingPortalResponse {
  url: string
}

export const billingApi = {
  getSubscription: () =>
    apiClient.get<SubscriptionResponse>('/billing/subscription').then((r) => r.data),

  createCheckout: (plan: Exclude<PlanName, 'free'>) =>
    apiClient.post<CheckoutResponse>('/billing/checkout', { plan }).then((r) => r.data),

  createPortal: () =>
    apiClient.post<BillingPortalResponse>('/billing/portal').then((r) => r.data),
}
