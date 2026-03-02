import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

// Stub the EditorToolbar — tested separately
vi.mock('@/components/manuscript/EditorToolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
}))

// BubbleMenu calls editor.registerPlugin which isn't available on the mock editor
vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

// TipTap doesn't work reliably in jsdom — stub the React bindings
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    isDestroyed: false,
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    commands: { setContent: vi.fn() },
    storage: { characterCount: { words: vi.fn(() => 0) } },
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({ undo: () => false, redo: () => false })),
    chain: vi.fn(() => ({ focus: vi.fn(() => ({ run: vi.fn() })) })),
  })),
  EditorContent: ({ className }: { className?: string }) => (
    <div data-testid="editor-content" className={className} />
  ),
}))

const { Editor } = await import('@/components/manuscript/Editor')
const mockedGet = vi.mocked(apiClient.get)

const PROJECT_ID = 'proj-abc'
const NODE_ID = 'node-xyz'

const EMPTY_DOCUMENT = {
  binder_node_id: NODE_ID,
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  byte_size: 40,
  updated_at: '2024-01-01T00:00:00Z',
}

function renderEditor(projectId = PROJECT_ID, nodeId = NODE_ID) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Editor projectId={projectId} nodeId={nodeId} />
    </QueryClientProvider>,
  )
}

describe('Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the document for the given nodeId', async () => {
    mockedGet.mockResolvedValueOnce({ data: EMPTY_DOCUMENT })
    renderEditor()
    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/documents/${NODE_ID}`,
      )
    })
  })

  it('renders the toolbar stub', async () => {
    mockedGet.mockResolvedValueOnce({ data: EMPTY_DOCUMENT })
    renderEditor()
    expect(await screen.findByTestId('editor-toolbar')).toBeInTheDocument()
  })

  it('renders the editor content area', async () => {
    mockedGet.mockResolvedValueOnce({ data: EMPTY_DOCUMENT })
    renderEditor()
    expect(await screen.findByTestId('editor-content')).toBeInTheDocument()
  })

  it('re-initializes when nodeId changes', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: EMPTY_DOCUMENT })
      .mockResolvedValueOnce({
        data: { ...EMPTY_DOCUMENT, binder_node_id: 'node-2' },
      })

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <Editor projectId={PROJECT_ID} nodeId={NODE_ID} />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))

    rerender(
      <QueryClientProvider client={qc}>
        <Editor projectId={PROJECT_ID} nodeId="node-2" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(mockedGet).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/documents/node-2`)
    })
  })
})
