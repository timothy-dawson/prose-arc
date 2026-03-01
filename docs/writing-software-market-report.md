# Prose Arc — Market Research Report
**February 2026**

---

## 1. Major Competitors

### Established Players

| Software | Type | Pricing | Target Audience | Key Strengths |
|----------|------|---------|-----------------|---------------|
| **Scrivener** | Desktop writing app | $59.99 one-time (per OS) | Serious fiction/nonfiction writers | Binder view, corkboard, outliner, index cards, composition mode. The "industry standard" for drafting. |
| **Atticus** | All-in-one (write + format + collaborate) | $147 one-time | Self-publishing authors | Write, collaborate, and format ePub/print in one tool. Cross-platform (browser-based). Beautiful book formatting. |
| **Microsoft Word** | General word processor | ~$99/yr (M365) | Everyone; editors especially love Track Changes | Ubiquitous, Track Changes for editing, but not built for books. Formatting for publishing is painful. |
| **Google Docs** | Cloud word processor | Free | Collaborators, co-authors, editors, beta readers | Real-time collaboration, free, accessible everywhere. Falls apart for long manuscripts. |
| **Vellum** | Book formatting | $249.99 one-time (Mac only) | Self-publishers needing beautiful formatting | Best-in-class ePub/print formatting. Mac only. No writing features. |
| **Ulysses** | Minimalist writing app | ~$49.99/yr subscription | Apple ecosystem writers | Beautiful distraction-free writing. Apple-only, subscription, no formatting or plotting. |

### Emerging / Growing Players

| Software | Type | Pricing | Target Audience | Key Strengths |
|----------|------|---------|-----------------|---------------|
| **Dabble Writer** | Novel writing platform | $9–$29/mo; $699 lifetime | Fiction writers, plotters | Plot Grid, story notes, word count goals, cloud sync, co-authoring, focus mode. User-friendly. |
| **Novelcrafter** | AI-integrated writing platform | $4–$20/mo | Fiction writers wanting AI + organization | Codex (wiki-style worldbuilding), series sharing, BYOK AI integration (OpenAI/Anthropic/local models), scene beats, collaboration, teams. |
| **Sudowrite** | AI writing assistant | $19–$59/mo | Fiction writers wanting AI brainstorming/drafting | AI-assisted drafting, brainstorming, scene expansion. Not a full manuscript tool—pairs with others. |
| **Plottr** | Visual outlining/plotting | Subscription (~$25/mo or ~$149 one-time) | Plotters, outliners, series writers | Visual timeline, 40+ story structure templates (Hero's Journey, Save the Cat, etc.), character arcs, series bible. Exports to Word/Scrivener. 40K+ users. |
| **Reedsy Studio** | Free writing + marketplace | Free | Authors seeking editors/designers | Free writing editor, writing challenges, marketplace connecting authors to professionals. |
| **ProWritingAid** | Editing/style checker | ~$30/mo or $399 lifetime | Self-editors wanting style analysis | Deep style, grammar, and readability analysis beyond basic spell-check. |

---

## 2. Feature Landscape Analysis

| Feature Area | Who Does It Well | Who's Missing It |
|---|---|---|
| **Outlining/Plotting** | Plottr (best visual plotting), Dabble (plot grid), Scrivener (corkboard/outliner) | Atticus (no plotting yet), Sudowrite, Ulysses, Google Docs |
| **AI-Assisted Writing** | Sudowrite (dedicated AI), Novelcrafter (BYOK AI) | Scrivener, Atticus, Plottr, Vellum — no AI at all |
| **Manuscript Management** | Scrivener (binder), Dabble (chapters/scenes), Novelcrafter (codex) | Google Docs (struggles with long docs), Word (not book-oriented) |
| **Collaboration** | Google Docs (real-time), Atticus (editor collaboration), Novelcrafter (teams), Dabble (co-authoring) | Scrivener (very poor), Plottr, Vellum, Ulysses |
| **Export/Formatting/Publishing** | Atticus (best all-in-one), Vellum (best formatting, Mac only) | Sudowrite (none), Dabble (basic), Novelcrafter (limited), Plottr (outline export only) |
| **Worldbuilding/Series Bible** | Novelcrafter (Codex + series sharing), Plottr (series bible) | Scrivener (manual), Atticus, Dabble, Sudowrite |
| **Cross-Platform** | Atticus, Dabble, Novelcrafter, Google Docs (all browser/cloud) | Scrivener (Win/Mac, slow updates), Vellum (Mac only), Ulysses (Apple only) |

---

## 3. Key Market Gaps

1. **No single tool does everything well.** Authors typically juggle 2–4 tools (e.g., Plottr for outlining → Scrivener for drafting → Google Docs for editing → Atticus/Vellum for formatting). This is the #1 pain point.

2. **AI integration is siloed.** Sudowrite is AI-only (no manuscript management). Novelcrafter has BYOK AI but limited formatting. Scrivener/Atticus have zero AI. No tool seamlessly blends AI assistance into a full writing-to-publishing pipeline.

3. **Plotting + Writing are rarely unified.** Plottr is the best plotter but has no writing editor. Scrivener's plotting is clunky. Dabble has a plot grid but limited depth. Novelcrafter is closest to unifying these.

4. **Collaboration is still weak.** Only Google Docs truly nails real-time collaboration, but it's terrible for books. Atticus mimics Word's Track Changes. No book-specific tool offers Google Docs-level real-time co-editing.

5. **Version control is primitive.** No tool offers proper manuscript versioning (branching, diffing, merging). Authors manually create "v1, v2, final, final-final" copies.

6. **No integrated feedback/beta reader pipeline.** Authors manually share exports, collect feedback via email/comments, and manually incorporate changes. No tool streamlines the beta reader workflow.

7. **Series management is underdeveloped.** Only Novelcrafter (shared Codex) and Plottr (series bible) address multi-book continuity. Writers of series desperately need cross-book consistency tools.

8. **Subscription fatigue vs. one-time pricing.** Authors strongly prefer one-time purchases (Atticus and Scrivener's key advantage). Many emerging tools are subscription-only, which creates anxiety about losing access to manuscripts.

---

## 4. Proposed Core Features for a Competitive New Tool

### Philosophy
**One workspace, idea to published book.** Eliminate the multi-tool juggle while offering best-in-class depth in each area. Offer a one-time purchase option with optional AI subscription add-on.

### Core Feature Set

#### A. Outlining & Plotting
- **Visual timeline** with drag-and-drop scenes, chapters, and arcs (à la Plottr)
- **40+ story structure templates** (Hero's Journey, Save the Cat, 3-Act, genre-specific)
- **Character arc tracking** overlaid on plot timeline
- **Relationship maps** — visual graph of character relationships
- **Worldbuilding wiki/codex** with auto-linking (à la Novelcrafter) shared across series

#### B. AI-Assisted Writing
- **BYOK model** — connect OpenAI, Anthropic, local models (Ollama/LM Studio), or use built-in credits
- **Context-aware AI** — AI reads your codex, outline, and prior chapters for consistent suggestions
- **Modes:** Brainstorm (ideas/what-if), Draft (continue writing), Expand (flesh out a scene), Revise (rewrite for tone/style), Summarize
- **Style matching** — AI learns your voice from existing manuscript text
- **AI as opt-in overlay**, not baked into the core editor — respects authors who don't want AI

#### C. Manuscript Management
- **Binder/tree view** for chapters, scenes, sections with drag-and-drop reordering
- **Split editor** — view outline/notes alongside manuscript
- **Focus/distraction-free mode**
- **Word count goals & tracking** with daily targets, streaks, days off
- **Snapshots & version control** — branch, diff, and restore any point in manuscript history (like Git, but author-friendly UI)
- **Series support** — shared worldbuilding, character database, and timeline across books

#### D. Collaboration
- **Real-time co-editing** (Google Docs-quality) with presence indicators
- **Editor mode** with Track Changes and inline comments
- **Beta reader portal** — share read-only links, collect structured feedback (chapter-level ratings, inline comments), aggregate responses in a dashboard
- **Role-based permissions** — author, co-author, editor, beta reader (view-only + comment)

#### E. Export & Publishing
- **Professional book formatting** — beautiful ePub, PDF (print-ready), and DOCX export with customizable templates and themes (à la Atticus/Vellum)
- **Direct publish** to KDP, IngramSpark, Draft2Digital, and other distributors
- **Query letter & synopsis generator** (AI-assisted) for traditional publishing path
- **Metadata management** — ISBN, categories, keywords, blurbs stored per book

#### F. Platform & Pricing
- **Cross-platform:** Desktop apps (Win/Mac/Linux) + web app + mobile (iOS/Android)
- **Offline-first** with cloud sync — manuscripts never held hostage
- **Pricing model:** One-time purchase ($149–$199) for core writing/formatting/collaboration. Optional AI subscription ($10–$20/mo) for AI features. Lifetime AI option available.
- **Data portability:** Import from Scrivener, Word, Google Docs. Export to all standard formats. Open file format (e.g., Markdown-based project files).

### Differentiators vs. Competition

| vs. Competitor | Our Advantage |
|---|---|
| vs. Scrivener | Modern UI, real-time collaboration, AI, cloud sync, cross-platform, better formatting |
| vs. Atticus | Plotting/outlining, AI, version control, beta reader pipeline, series management |
| vs. Dabble | Deeper plotting, AI, professional formatting, one-time pricing option |
| vs. Novelcrafter | Professional formatting/publishing, offline-first, one-time pricing, visual timeline |
| vs. Sudowrite | Full manuscript management, formatting, collaboration — not just AI |
| vs. Plottr | Integrated writing editor + formatting — no need to export elsewhere |

---

## 5. Summary

The market is fragmented. Authors are forced to chain together 2–4 tools and suffer version-control headaches, context-switching, and subscription fatigue. The opportunity is a **unified, offline-capable, cross-platform tool** that genuinely does plotting → writing → AI assistance → collaboration → formatting → publishing in one place, with a one-time purchase core and optional AI subscription. Novelcrafter is the closest emerging competitor to this vision but lacks professional formatting and one-time pricing. Atticus is the closest established competitor but lacks plotting and AI entirely. The gap between these two products is where the opportunity lives.
