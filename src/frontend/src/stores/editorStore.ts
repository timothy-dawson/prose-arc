import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'
export type SidebarTab = 'binder' | 'codex'
export type ActivePanel = 'editor' | 'history' | 'goals'

interface EditorState {
  currentProjectId: string | null
  currentNodeId: string | null
  isDirty: boolean
  saveStatus: SaveStatus
  wordCount: number
  showSearch: boolean
  sidebarTab: SidebarTab
  activeCodexEntryId: string | null
  showKanban: boolean

  // Panel routing
  activePanel: ActivePanel
  setActivePanel: (panel: ActivePanel) => void

  // Focus mode
  focusMode: boolean
  setFocusMode: (val: boolean) => void

  // Session tracking (ephemeral — not persisted)
  sessionId: string | null
  sessionStartTime: number | null
  wordsAtSessionStart: number
  setSession: (id: string, startTime: number, startWords: number) => void
  clearSession: () => void

  setCurrentProject: (id: string | null) => void
  setCurrentNode: (id: string | null) => void
  setDirty: (dirty: boolean) => void
  setSaveStatus: (status: SaveStatus) => void
  setWordCount: (n: number) => void
  toggleSearch: () => void
  setSidebarTab: (tab: SidebarTab) => void
  setActiveCodexEntry: (id: string | null) => void
  toggleKanban: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  currentProjectId: null,
  currentNodeId: null,
  isDirty: false,
  saveStatus: 'saved',
  wordCount: 0,
  showSearch: false,
  sidebarTab: 'binder',
  activeCodexEntryId: null,
  showKanban: false,

  activePanel: 'editor',
  setActivePanel: (panel) => set({ activePanel: panel }),

  focusMode: false,
  setFocusMode: (val) => set({ focusMode: val }),

  sessionId: null,
  sessionStartTime: null,
  wordsAtSessionStart: 0,
  setSession: (id, startTime, startWords) =>
    set({ sessionId: id, sessionStartTime: startTime, wordsAtSessionStart: startWords }),
  clearSession: () =>
    set({ sessionId: null, sessionStartTime: null, wordsAtSessionStart: 0 }),

  setCurrentProject: (id) =>
    set({
      currentProjectId: id,
      currentNodeId: null,
      isDirty: false,
      saveStatus: 'saved',
      wordCount: 0,
      showSearch: false,
      sidebarTab: 'binder',
      activeCodexEntryId: null,
      showKanban: false,
      activePanel: 'editor',
      focusMode: false,
      sessionId: null,
      sessionStartTime: null,
      wordsAtSessionStart: 0,
    }),
  setCurrentNode: (id) =>
    set({ currentNodeId: id, isDirty: false, saveStatus: 'saved', wordCount: 0 }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setWordCount: (n) => set({ wordCount: n }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setActiveCodexEntry: (id) =>
    set({ activeCodexEntryId: id, sidebarTab: 'codex' }),
  toggleKanban: () => set((s) => ({ showKanban: !s.showKanban })),
}))
