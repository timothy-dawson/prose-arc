import { Extension } from '@tiptap/core'

export interface TypewriterScrollOptions {
  enabled: boolean
}

/**
 * Keeps the cursor vertically centered while typing in focus mode.
 * On each selection update, smoothly scrolls the nearest .focus-wrapper
 * so the cursor sits at roughly 50% of the viewport height.
 */
export const TypewriterScroll = Extension.create<TypewriterScrollOptions>({
  name: 'typewriterScroll',

  addOptions() {
    return {
      enabled: false,
    }
  },

  onSelectionUpdate() {
    if (!this.options.enabled) return

    const { from } = this.editor.state.selection
    const coords = this.editor.view.coordsAtPos(from)
    const wrapper = this.editor.view.dom.closest('.focus-wrapper') as HTMLElement | null
    if (!wrapper) return

    const targetScrollTop = wrapper.scrollTop + coords.top - window.innerHeight / 2
    wrapper.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  },
})
