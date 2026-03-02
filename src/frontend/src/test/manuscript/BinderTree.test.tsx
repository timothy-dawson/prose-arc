import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BinderTree } from '@/components/manuscript/BinderTree'
import { apiClient } from '@/api/client'
import type { BinderNodeRead } from '@/api/manuscripts'

vi.mock('@/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

const mockedPost = vi.mocked(apiClient.post)
const mockedDelete = vi.mocked(apiClient.delete)

const PROJECT_ID = 'proj-abc'

const NODES: BinderNodeRead[] = [
  {
    id: 'folder-1',
    project_id: PROJECT_ID,
    parent_id: null,
    node_type: 'folder',
    title: 'Act One',
    sort_order: 0,
    synopsis: null,
    metadata: {},
    word_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'chapter-1',
    project_id: PROJECT_ID,
    parent_id: 'folder-1',
    node_type: 'chapter',
    title: 'Chapter 1',
    sort_order: 0,
    synopsis: null,
    metadata: {},
    word_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

function renderTree(nodes: BinderNodeRead[] = NODES) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BinderTree projectId={PROJECT_ID} nodes={nodes} />
    </QueryClientProvider>,
  )
}

describe('BinderTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders root nodes', () => {
    renderTree()
    expect(screen.getByText('Act One')).toBeInTheDocument()
  })

  it('shows empty message when no nodes', () => {
    renderTree([])
    expect(screen.getByText(/no chapters yet/i)).toBeInTheDocument()
  })

  it('expands folder to reveal children', async () => {
    const user = userEvent.setup()
    renderTree()

    // Children not visible initially (folder collapsed)
    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument()

    // Click expand button (▸)
    await user.click(screen.getByText('▸'))
    expect(screen.getByText('Chapter 1')).toBeInTheDocument()
  })

  it('renders add-root action buttons', () => {
    renderTree()
    expect(screen.getByTitle(/new folder/i)).toBeInTheDocument()
    expect(screen.getByTitle(/new chapter/i)).toBeInTheDocument()
    expect(screen.getByTitle(/new scene/i)).toBeInTheDocument()
  })

  it('calls createNode on add folder button click', async () => {
    const user = userEvent.setup()
    mockedPost.mockResolvedValueOnce({
      data: {
        id: 'new-folder',
        project_id: PROJECT_ID,
        parent_id: null,
        node_type: 'folder',
        title: 'New Folder',
        sort_order: 1,
      },
    })
    renderTree()
    await user.click(screen.getByTitle(/new folder/i))
    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/binder`,
        expect.objectContaining({ node_type: 'folder', title: 'New Folder' }),
      )
    })
  })

  it('shows context menu on right-click', async () => {
    const user = userEvent.setup()
    renderTree()
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Act One') })
    expect(await screen.findByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls deleteNode from context menu', async () => {
    const user = userEvent.setup()
    mockedDelete.mockResolvedValueOnce({ data: null })
    renderTree()

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Act One') })
    const deleteBtn = await screen.findByText('Delete')
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/binder/folder-1`,
      )
    })
  })
})
