# Documentation Overhaul

| Field    | Value      |
| -------- | ---------- |
| Priority | high       |
| Created  | 2026-04-17 |
| Updated  | 2026-04-17 |

## Description

Comprehensive overhaul of the project documentation (`docs/`). Goals:

- Extract a transferable MVT Architecture specification section
- Rename top-level sections to Learn / Topics / Reference / Architecture
- Improve clarity and accessibility for newcomers
- Strengthen model-view separation explanations with better analogies
- Rewrite and better integrate the reactivity guide
- Expand coverage of testing, presentation state, and complex sequences
- Audit and revise architecture rules
- Reduce duplication across AGENTS.md, copilot-instructions, and docs
- Improve navigation with sidebar grouping and structural fixes
- Ensure all code examples are self-explanatory and universal

The final sidebar structure will be:

```
MVT Architecture           (transferable specification - 7 pages, done)
Building with MVT          (progressive learning + topics, merged)
  Quickstart               (standalone - done, needs relocation)
  The Game Loop            (standalone - frame sequence, deltaMs, ordering)
  Simulating the World     (group - models, time, composition)
  Presenting the World     (group - views, bindings, view composition)
  Reacting to Changes      (group - reactivity, change detection, alternatives)
  Animating Transitions    (group - state machines, sequences, phases - NEW)
  Adding Visual Polish     (group - presentation state, view models - REWRITE)
  Iterating with Confidence (group - testing patterns - EXPAND)
  Avoiding Pitfalls        (group - common issues, antipatterns, hot paths)
MVT Reference              (terse lookup - 4 pages, done)
AI Agents                  (collapsed, unchanged)
```

Pages removed from docs:

- `topics/adding-a-game.md` - move to `src/games/README.md`
- `learn/walkthrough.md` - drop (future interactive tutorial)
- `learn/what-is-mvt.md` - absorb into Architecture section
- `learn/architecture-overview.md` - merge into The Game Loop
- `learn/next-steps.md` - drop (progressive sidebar replaces it)
- `reactivity/` (7 pages) - condense into 3 pages under Reacting to Changes

Future additions (not in scope for this overhaul):

- **Interactive tutorials** - step-by-step build-alongs (e.g. an interactive
  walkthrough replacing the dropped static walkthrough page).
- **Recipes / How-to** section - task-oriented guides ("How to animate a state
  transition", "How to add a new entity"). If a critical mass of recipe-style
  content emerges, splitting into a dedicated section would be justified.

Supporting artefacts in this directory:

- `site-map.md` - full ToC of the current docs structure

## Plan

Steps are grouped into phases. Within each phase, steps can be done in any
order. Phases should be completed roughly in order, since later phases may
depend on structural changes made in earlier ones.

Some steps are marked **[PLAN FIRST]** - these need further design iteration
before implementation. The planning substep should produce a brief outline in
this task directory, to be reviewed before writing begins.

### Phase 1 - Architecture extraction and structural skeleton

Extract the transferable MVT specification and reshape the top-level structure.
Get the skeleton right before revising content.

**1.1 - Create the Architecture section**

New section `docs/architecture/` containing the transferable MVT specification.
These pages describe contracts and constraints using pseudocode or
language-neutral notation - not TypeScript, not Pixi, not GSAP. Think
Twelve-Factor App density: terse, principled, complete. Target ~4-6 pages:

| Page | Content |
|---|---|
| Overview | The problem, the solution, the three layers - no language, no renderer |
| Models | What a model is, the `update(deltaMs)` contract, domain-level state, what doesn't belong |
| Views | What a view is, statelessness, the `refresh()` contract, presentation state boundary |
| Bindings | The bridging concept, `get*()`/`on*()` pattern, why not pass the model directly |
| The Ticker | Frame sequence, time ownership, determinism |
| Architecture Rules | Only the universal MVT constraints (no code style, no repo conventions) |

The boundary test for what belongs here: "Would this apply if you implemented
MVT in Godot/GDScript or Unity/C#?" If yes, it's architecture. If no, it's
implementation-specific and belongs in Learn/Topics/Reference.

**1.2 - Rename top-level sections**

- `guide/` -> `topics/` (directory rename + all cross-links)
- Update sidebar, landing page, and all internal references to use the new
  names: Learn / Topics / Reference
- The Architecture section is a new peer section in the sidebar

**1.3 - Relocate contributing guide out of docs**

The contributing guide is about maintaining the docs repo, not about MVT. Move
it to a repo-level location (e.g. `CONTRIBUTING.md` or keep it in docs but
remove it from the docs sidebar/navigation as a top-level section). The docs
landing page should not present "Contributing" as a peer of the main sections.

**1.4 - Integrate the foundations page**

`docs/foundations/proven-patterns.md` is a one-page orphan section. Fold it
into the Architecture section as a "Background" or "Heritage" page (it covers
the transferable pattern heritage behind MVT), or link it from the
Architecture overview. Eliminate `foundations/` as a standalone section.

**1.5 - Group Topics pages in the sidebar**

The Topics section (currently 10 pages) needs subclusters in the sidebar
rather than a flat list. Proposed grouping:

- **Core patterns:** Time Management, Hot Paths, Change Detection
- **Composition:** Model Composition, View Composition, Bindings in Depth
- **Building:** Presentation State, Testing, Adding a Game
- **Troubleshooting:** Common Mistakes

Consider elevating Common Mistakes to higher visibility (prominent landing
page link, or rename to "Anti-patterns" and expand). Elixir gives
anti-patterns their own guide path - mistakes are often what people search
for.

**1.6 - Fix the landing page**

- Fix the "Three Layers" diagram/heading mismatch (the numbered 1/2/3 items
  are the frame sequence, not the three layers)
- Add a brief "How this documentation is organized" paragraph (like Django)
  explaining what Architecture, Learn, Topics, and Reference each contain
- Remove or relocate the Contributing link from the main navigation paths
- Add the Architecture section as a top-level navigation path
- Ensure the Reference path on the landing page only lists actual reference
  pages (currently mixes in foundations and reactivity)
- Consider profile-based or use-case entry points (Godot's "I am X" tiles,
  Stripe's "What do you want to do?") as a complement to the section-based
  navigation

**1.7 - Reduce duplication across agent files**

AGENTS.md, `docs/ai-agents/index.md`, and `.github/copilot-instructions.md`
all restate architecture, rules, conventions, and project structure. Designate
one as canonical (likely AGENTS.md since it's the agent entry point), and have
the others be thin wrappers that link to it or to the relevant docs pages.
Agent files should reference the Architecture section for universal principles
rather than restating them. Also add an `llms.txt` file (as Svelte and Stripe
provide) giving LLMs a compressed entry point to the docs without needing to
duplicate content in agent files.

### Phase 2 - Clarity and content quality pass

Revise existing content for clarity, tone, and examples, without adding new
topics. The Learn path remains integrated (teaching MVT principles AND this
repo's implementation together). Learn pages reference the Architecture section
for readers who want the pure principle, with a light touch (e.g. "This
implements the [model contract](../architecture/models.md)").

**2.1 - Strengthen model-view separation explanations**

Across the Learn path (especially `what-is-mvt.md`, `models.md`, `views.md`):

- Add the "headless simulation" analogy for models prominently and early
- Add more analogies and restate the separation from multiple angles
- Ensure a reader who has never seen MVVM/MVC can grasp the separation from
  the Learn path alone

**2.2 - Audit all code examples**

Review every code example in the docs for:

- **Self-containment:** Can a reader understand the example without prior
  context? If not, simplify or add brief inline commentary.
- **Universality:** Replace obscure game-specific examples with common/
  universal ones (counters, timers, simple motion, basic collision).
- **Style compliance:** All examples should follow the project's code style.
- **Hot-path safety:** No examples demonstrating patterns the docs advise
  against (per-tick allocations, template strings in refresh, etc.).
- **Architecture vs convention:** Use consistent callouts (e.g. a VitePress
  container) when an example shows a repo convention rather than an MVT
  requirement.

**2.3 - Audit all diagrams and add new ones**

Review every existing diagram and ASCII art for:

- Heading/content alignment (no mismatches like the "Three Layers" issue)
- Accuracy relative to current architecture
- Clarity for a first-time reader

Add new diagrams where they would build intuition (React and Vue use diagrams
extensively for state flow and component trees). Priority candidates:

- Model composition tree (parent-child delegation)
- View hierarchy and how bindings wire through it
- The frame loop as a proper diagram (not just ASCII)
- Bindings data flow (model -> bindings -> view -> scene graph)

**2.4 - Add "You will learn" / prerequisites callouts**

For each Learn page, add a boxed list of learning objectives at the top (like
React). For Topics pages, add a brief "Assumes familiarity with:" line linking
prerequisites.

**2.5 - Add playground links to key examples**

For examples where seeing the running result builds intuition (frame loop,
deltaMs, bindings, common mistakes), add a "Run in Playground" link that opens
the existing playground with a matching preset. Create new playground presets as
needed.

**2.6 - Add a quickstart page**

A single page that gets the reader to running code before the Learn path
explains why. Target: under 5 minutes from opening the page to seeing
something working in the playground. Structure:

1. Here's a model (paste this)
2. Here's a view (paste this)
3. Run it (playground link)
4. Now go learn why this works -> Learn path

This front-loads the reward and gives context for the conceptual material
that follows. Place it before or alongside the Learn path entry point.

### Phase 3 - Restructure into "Building with MVT"

Merge the Learn and Topics sections into a single progressive "Building with
MVT" section. This is the structural migration - content rewrites happen in
later phases where noted.

**3.1 - Create the new sidebar structure**

Replace the separate Learn and Topics sidebar sections with a single "Building
with MVT" section using the group structure defined above. Update
`.vitepress/config.ts`.

**3.2 - Create "The Game Loop" page**

Merge `learn/architecture-overview.md` and `learn/ticker.md` into a single new
page covering: the frame sequence (model.update -> view.update -> view.refresh
-> render), deltaMs, deterministic time, and ordering guarantees. Practical
focus: "here's the loop your code lives inside".

**3.3 - Absorb "What is MVT?" into Architecture**

Move relevant conceptual content from `learn/what-is-mvt.md` into the
Architecture section (primarily `architecture/index.md`). The Architecture
section becomes the single home for "what MVT is and why". Delete or redirect
the Learn page.

**3.4 - Relocate existing pages into new groups**

Move existing pages into their new sidebar groups without rewriting content:

| Group | Pages |
|---|---|
| Simulating the World | `learn/models.md`, `topics/time-management.md`, `topics/model-composition.md` |
| Presenting the World | `learn/views.md`, `learn/bindings.md`, `topics/view-composition.md`, `topics/bindings-in-depth.md` |
| Reacting to Changes | `topics/change-detection.md` (+ new pages in Phase 4) |
| Adding Visual Polish | `topics/presentation-state.md` (rewrite in Phase 5) |
| Iterating with Confidence | `topics/testing.md` (expand in Phase 5) |
| Avoiding Pitfalls | `topics/common-issues.md`, `topics/hot-paths.md` |

**3.5 - Remove pages from docs**

- Move `topics/adding-a-game.md` content to `src/games/README.md`
- Delete `learn/walkthrough.md` (future interactive tutorial)
- Delete `learn/next-steps.md` (progressive sidebar replaces it)
- Delete or redirect `learn/what-is-mvt.md` and `learn/architecture-overview.md`
  after content is absorbed

**3.6 - Update landing page and cross-links**

Update `docs/index.md` to reflect the new "Building with MVT" structure.
Fix all cross-links broken by page moves and deletions.

### Phase 4 - Reactivity rewrite

Condense `docs/reactivity/` (7 pages) into 3 pages under Reacting to Changes.

**4.1 - Write the Reactivity page**

New page making the case for polling in game loops. Covers: the change
detection problem, how the game loop favours polling, why push-based approaches
add friction, tradeoffs. Absorbs content from `reactivity/index.md` and
`reactivity/push-vs-pull.md`.

**4.2 - Revise the Change Detection page**

Update `topics/change-detection.md` to serve as the practical "how to poll"
page. Covers: watch() helper, which values to watch, when to watch vs read
directly, consumer-defined events, dynamic child lists.

**4.3 - Write the Events and Signals page**

New condensed page giving a fair treatment of push-based alternatives. Covers:
events (strengths and game-loop friction), signals (strengths and friction),
side-by-side comparison. For curious readers. Absorbs content from
`reactivity/events.md`, `reactivity/signals.md`, `reactivity/comparison.md`.

**4.4 - Delete the standalone reactivity section**

Remove `docs/reactivity/` directory and its 7 pages. Remove from sidebar.
Redirect or update any remaining cross-links.

### Phase 5 - New and rewritten topics

Steps marked **[PLAN FIRST]** need a brief outline reviewed before writing.

**5.1 - Rewrite Presentation State [PLAN FIRST]** (Adding Visual Polish)

Full rewrite of `presentation-state.md`. Topics to cover:

1. Time in views - how views receive and use `deltaMs`, when views need
   `update()` vs being purely stateless
2. View models - when to extract, how to structure, relationship to views
3. Complex view logic and testability - keeping presentation logic testable

Planning substep: produce a topic outline with section headings, key examples,
and decision criteria before writing.

**5.2 - New topic: Animating Transitions [PLAN FIRST]**

New page(s) covering MVT patterns for complex timed sequences. Three scenario
categories:

1. Multiple mutually-exclusive phases (state machine pattern)
2. Open-ended phases paired with cyclic animations
3. Fully-general complex sequences with overlapping steps and repeated loops

Planning substep: produce a topic outline with scenarios, patterns, and example
sketches before writing.

**5.3 - Expand testing coverage** (Iterating with Confidence)

Expand `testing.md` into a substantially larger page or multiple pages:

- Model testing - patterns, time-stepping helpers, factory-with-defaults
- View testing - scene graph assertions, snapshot testing, mock bindings
- Testing techniques - deterministic time, testing composed models
- Testing anti-patterns - what not to test, over-testing internals

### Phase 6 - Rules revision

**6.1 - Audit and split architecture rules**

Review every rule in `docs/reference/architecture-rules.md` and split them:

- **Universal MVT rules** move to `docs/architecture/rules.md`
- **Repo-specific conventions** stay in Reference (style guide or conventions)

For each rule: identify universal vs repo-specific, check for missing
constraints, consider "must" vs "should" tiers, ensure clear rationale.

**6.2 - Revise rule naming scheme**

Replace brittle M1-M5 / V1-V9 numbering with a stable scheme (e.g. descriptive
names like ESLint's `no-wall-clock-time`, or numbered with gaps). Update all
references in docs, AGENTS.md, skill files, and code review checklists.

**6.3 - Propagate rule changes**

Update all files referencing rules: `skill-code-review.md`,
`common-mistakes.md`, `AGENTS.md`, `.github/copilot-instructions.md`.

### Phase 7 - Final polish

**7.1 - Cross-link audit**

Walk every page and verify all Related/Next/Previous links. Ensure new pages
are linked from relevant siblings. Verify glossary has entries for all
introduced terms. Verify landing page reflects final structure.

**7.2 - Update AI agent files**

Ensure AGENTS.md and skill files reflect the final docs structure.

**7.3 - Update site-map.md**

Regenerate the site map artefact in this task directory.

## Acceptance Criteria

Phase 1-2 (done):
- [x] Architecture section created with 7 transferable specification pages
- [x] Top-level sections renamed; landing page fixed
- [x] Contributing guide removed from sidebar
- [x] Foundations integrated into Architecture heritage page
- [x] Topics sidebar grouped into subclusters
- [x] Agent file duplication reduced; llms.txt added
- [x] Model-view separation explanations strengthened
- [x] Code examples audited; diagrams audited and added
- [x] Prerequisite callouts added to Topics pages
- [x] Playground links added to key examples
- [x] Quickstart page added

Phase 3 (restructure):
- [ ] Learn and Topics merged into "Building with MVT" with 9 sidebar groups
- [ ] "The Game Loop" page created from merged ticker/architecture-overview
- [ ] "What is MVT?" absorbed into Architecture section
- [ ] `adding-a-game.md` moved to `src/games/README.md`
- [ ] `walkthrough.md` and `next-steps.md` deleted
- [ ] Landing page and all cross-links updated

Phase 4 (reactivity):
- [ ] Reactivity page written (why polling)
- [ ] Change Detection page revised (how to poll)
- [ ] Events and Signals page written (alternatives)
- [ ] Standalone `reactivity/` section deleted

Phase 5 (new content):
- [ ] Presentation State rewritten (planned, then written)
- [ ] Animating Transitions written (planned, then written)
- [ ] Testing coverage expanded

Phase 6 (rules):
- [ ] Architecture rules split: universal in Architecture, repo-specific in Reference
- [ ] Rule naming scheme revised and references updated

Phase 7 (polish):
- [ ] Cross-links verified across all pages
- [ ] AI agent files updated
- [ ] Site map updated to reflect final structure

## Progress Log

- 2026-04-17 - Task created. Initial site map produced (`site-map.md`).
- 2026-04-17 - Full plan defined (6 phases, 22 steps). Architecture separation
  and Learn/Topics/Reference naming incorporated.
- 2026-04-17 - Completeness review. Added: llms.txt (1.7), anti-patterns
  visibility (1.5), quickstart page (2.6), new diagrams (2.3), Recipes as
  future addition. Total: 6 phases, 23 steps.
- 2026-04-18 - **Phase 1 complete.** All 7 steps done:
  - 1.1: Created docs/architecture/ with 6 pages (index, models, views,
    bindings, ticker, rules, heritage). Language-neutral, pseudocode only.
  - 1.2: Renamed docs/guide/ to docs/topics/. Updated ~15 files with
    ../guide/ -> ../topics/ references.
  - 1.3: Removed Contributing from sidebar (page remains at docs/contributing.md).
  - 1.4: Condensed foundations/proven-patterns.md into architecture/heritage.md.
    Original file now a redirect stub. Removed Foundations sidebar section.
  - 1.5: Grouped Topics sidebar into 4 subclusters (Core Patterns, Composition,
    Building, Troubleshooting).
  - 1.6: Rewrote docs/index.md landing page. Three Layers table, Frame Sequence
    diagram, organized reading paths table.
  - 1.7: Thinned docs/ai-agents/index.md to ~50-line wrapper pointing to
    AGENTS.md. Created llms.txt at repo root. Updated AGENTS.md and
    .github/copilot-instructions.md to reference new architecture section.
  - Build and lint pass clean.
- 2026-04-18 - **Phase 2 complete.** All 6 steps done:
  - 2.1: Strengthened model-view separation in Learn pages (headless simulation
    analogy, additional angles).
  - 2.2: Audited all code examples, fixed 3 bugs.
  - 2.3: Fixed architecture-overview flowchart bindings data flow. Added model
    composition mermaid diagram to models.md.
  - 2.4: Added prerequisite lines to all Topics pages. Learn page callouts
    added then removed (just repeated sidebar headings).
  - 2.5: Added playground links to models.md (countdown-timer), views.md
    (score-counter), bindings.md (keyboard-sprite). Created clock preset.
  - 2.6: Added quickstart page (bouncing ball with domain units/metres, SCALE
    conversion in view, links to bouncing-ball playground preset).
  - Build passes clean.
- 2026-04-19 - **Plan revised.** Merged Learn + Topics into single "Building
  with MVT" section with 9 progressive groups. Phases renumbered (now 7).
  Key changes: dissolved "Core Concepts" (ticker -> Game Loop, models ->
  Simulating the World, views/bindings -> Presenting the World); added
  "Adding Visual Polish" group for presentation state; dropped walkthrough,
  next-steps, adding-a-game from docs; reactivity condensed to 3 pages under
  Reacting to Changes.
