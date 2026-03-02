import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '@/pages/DashboardPage'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock useCurrentUser so it returns a display name without hitting the API
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { display_name: 'Alice', email: 'alice@example.com' } }),
}))

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SAMPLE_PROJECTS = [
  {
    id: 'proj-1',
    title: 'My Novel',
    word_count: 12345,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'proj-2',
    title: 'Short Stories',
    word_count: 0,
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-06-02T00:00:00Z',
  },
]

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders welcome message with user name', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })
    renderDashboard()
    expect(await screen.findByText(/welcome back, alice/i)).toBeInTheDocument()
  })

  it('shows empty state when no projects exist', async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })
    renderDashboard()
    expect(await screen.findByText(/no projects yet/i)).toBeInTheDocument()
  })

  it('renders project cards', async () => {
    mockedGet.mockResolvedValueOnce({ data: SAMPLE_PROJECTS })
    renderDashboard()
    expect(await screen.findByText('My Novel')).toBeInTheDocument()
    expect(screen.getByText('Short Stories')).toBeInTheDocument()
    expect(screen.getByText('12,345 words')).toBeInTheDocument()
  })

  it('opens new project dialog on button click', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValueOnce({ data: [] })
    renderDashboard()
    await screen.findByText(/no projects yet/i)
    await user.click(screen.getAllByRole('button', { name: /new project/i })[0])
    expect(await screen.findByPlaceholderText(/project title/i)).toBeInTheDocument()
  })

  it('creates a project and navigates away', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValueOnce({ data: [] })
    mockedPost.mockResolvedValueOnce({
      data: { id: 'new-proj', title: 'Epic Fantasy', word_count: 0 },
    })
    // Second GET after invalidation
    mockedGet.mockResolvedValueOnce({ data: [] })

    renderDashboard()
    await screen.findByText(/no projects yet/i)

    await user.click(screen.getAllByRole('button', { name: /new project/i })[0])
    const input = await screen.findByPlaceholderText(/project title/i)
    await user.type(input, 'Epic Fantasy')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith('/projects', { title: 'Epic Fantasy' })
    })
  })

  it('shows delete confirmation before deleting', async () => {
    const user = userEvent.setup()
    mockedGet.mockResolvedValueOnce({ data: SAMPLE_PROJECTS })
    renderDashboard()
    await screen.findByText('My Novel')

    // Hover shows the × button — it's opacity-0 group-hover but still in DOM
    const deleteBtn = screen.getAllByTitle(/delete project/i)[0]
    await user.click(deleteBtn)

    expect(await screen.findByText(/delete "my novel"/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })
})
