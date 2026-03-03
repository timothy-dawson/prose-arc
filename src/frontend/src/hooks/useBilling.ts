import { useMutation, useQuery } from '@tanstack/react-query'
import { billingApi } from '@/api/billing'
import type { PlanName } from '@/api/billing'

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: billingApi.getSubscription,
    staleTime: 60_000, // 1 min
  })
}

export function useCheckout() {
  return useMutation({
    mutationFn: (plan: Exclude<PlanName, 'free'>) => billingApi.createCheckout(plan),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: billingApi.createPortal,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })
}
