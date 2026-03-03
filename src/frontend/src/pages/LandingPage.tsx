import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Write & Plot — Together',
    description:
      'A unified binder, outliner, and rich-text editor. No more switching between Scrivener and Plottr.',
    icon: '✍️',
  },
  {
    title: 'Worldbuilding Codex',
    description:
      'Characters, locations, items, and lore in one searchable reference — linked to your manuscript.',
    icon: '📚',
  },
  {
    title: 'AI That Knows Your Story',
    description:
      'Context-aware AI that reads your codex and outline. Brainstorm, draft, expand, and revise — your voice, your rules.',
    icon: '✨',
  },
]

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Prose Arc</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Start writing
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl">
            Your story, from first spark to final page.
          </h1>
          <p className="mt-6 text-xl text-gray-500">
            Prose Arc unifies plotting, writing, worldbuilding, AI assistance, and publishing in
            one distraction-free app. Built for serious authors.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/register"
              className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-blue-500"
            >
              Start for free
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-gray-300 dark:border-gray-600 px-6 py-3 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-lg bg-white dark:bg-gray-900 p-6 shadow-sm">
                <div className="mb-4 text-4xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Prose Arc. All rights reserved.
      </footer>
    </div>
  )
}
