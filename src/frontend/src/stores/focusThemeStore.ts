import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FocusTheme = 'minimal' | 'dark' | 'sepia' | 'forest'

interface FocusThemeState {
  focusTheme: FocusTheme
  setFocusTheme: (theme: FocusTheme) => void
}

export const useFocusThemeStore = create<FocusThemeState>()(
  persist(
    (set) => ({
      focusTheme: 'minimal',
      setFocusTheme: (theme) => set({ focusTheme: theme }),
    }),
    { name: 'prose-arc-focus-theme' },
  ),
)
