import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage'

// Heavy pages are lazy-loaded so they split into separate JS chunks
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const BillingPage = lazy(() => import('@/pages/BillingPage').then(m => ({ default: m.BillingPage })))
const ProjectPage = lazy(() => import('@/pages/ProjectPage').then(m => ({ default: m.ProjectPage })))

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />

              {/* Protected routes — require authentication */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                </Route>
                {/* ProjectPage has its own full-screen layout, no AppShell */}
                <Route path="/projects/:projectId" element={<ProjectPage />} />
              </Route>

              {/* 404 fallback */}
              <Route
                path="*"
                element={
                  <div className="flex min-h-screen items-center justify-center text-gray-500">
                    Page not found
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
