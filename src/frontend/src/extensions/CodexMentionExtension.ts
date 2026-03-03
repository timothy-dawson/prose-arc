import { Mark, mergeAttributes } from '@tiptap/core'

export const CodexMention = Mark.create({
  name: 'codexMention',

  addAttributes() {
    return {
      entryId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-codex-entry-id'),
        renderHTML: (attrs) => ({ 'data-codex-entry-id': attrs.entryId }),
      },
      entryName: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-codex-entry-name'),
        renderHTML: (attrs) => ({ 'data-codex-entry-name': attrs.entryName }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-codex-entry-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'codex-mention' }, HTMLAttributes), 0]
  },
})
