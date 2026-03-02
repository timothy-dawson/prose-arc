import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

interface EditorState {
  currentProjectId: string | null
  currentNodeId: string | null
  isDirty: boolean
  saveStatus: SaveStatus
  wordCount: number
  showSearch: boolean

  setCurrentProject: (id: string | null) => void
  setCurrentNode: (id: string | null) => void
  setDirty: (dirty: boolean) => void
  setSaveStatus: (status: SaveStatus) => void
  setWordCount: (n: number) => void
  toggleSearch: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  currentProjectId: null,
  currentNodeId: null,
  isDirty: false,
  saveStatus: 'saved',
  wordCount: 0,
  showSearch: false,

  setCurrentProject: (id) =>
    set({ currentProjectId: id, currentNodeId: null, isDirty: false, saveStatus: 'saved', wordCount: 0, showSearch: false }),
  setCurrentNode: (id) =>
    set({ currentNodeId: id, isDirty: false, saveStatus: 'saved', wordCount: 0 }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setWordCount: (n) => set({ wordCount: n }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
}))
