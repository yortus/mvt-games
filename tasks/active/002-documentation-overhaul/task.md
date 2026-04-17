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
Architecture       (new - transferable MVT specification)
Learn              (was learn/ - sequential introduction, unchanged content)
Topics             (was guide/ - self-contained topic pages, grouped)
Reference          (was reference/ - terse lookup pages)
Reactivity         (rewritten - integrated supplementary section)
AI Agents          (unchanged - agent-specific entry points)
```

Future additions (not in scope for this overhaul):

- **Tutorials** section - step-by-step build-alongs with interactive examples,
  sitting between Learn and Topics when foundational content is solid.
- **Recipes / How-to** section - task-oriented guides ("How to animate a state
  transition", "How to add a new entity"). Currently some Topics pages are
  partly recipe-like (Adding a Game, Common Mistakes). If a critical mass of
  recipe-style content emerges, splitting into a dedicated section would be
  justified.

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

### Phase 3 - Reactivity guide rewrite

Complete rewrite of `docs/reactivity/`. The current 7 pages were written before
the contributing guide and don't follow its philosophy.

**3.1 - Rename "watchers" to "polling"**

The taxonomy becomes "events vs signals vs polling" - three genuinely distinct
reactivity strategies. Update all references, filenames, and cross-links.

**3.2 - Write a new entry-point page**

Replace `docs/reactivity/index.md` with a page that:

- Explains why this topic matters for MVT (the project chose polling - why?)
- Summarises the key tradeoffs and conclusions in one skim-friendly page
- Links out to the detailed comparison pages for readers who want depth
- Fits seamlessly into the wider docs navigation (linked from `next-steps.md`
  and the landing page's Reference section)

**3.3 - Condense the detail pages**

Rewrite `push-vs-pull.md`, `events.md`, `signals.md`, `polling.md` (was
`watchers.md`), `comparison.md`, and `examples.md` to:

- Follow skim-first structure (summary, tables/callouts, then depth)
- Be significantly shorter (target ~150-250 lines each, down from current)
- Preserve the neutral, fair comparative tone
- Use consistent structure across the three approach pages

### Phase 4 - New and rewritten topics

These add substantial new content. Steps marked [PLAN FIRST] need a brief
outline reviewed before implementation.

**4.1 - Rewrite Presentation State [PLAN FIRST]**

Full rewrite of `docs/topics/presentation-state.md`, incorporating learnings
from the Cactii game implementation. Topics to cover:

1. Time in views - how views receive and use `deltaMs`, when views need
   `update()` vs being purely stateless
2. View models - when to extract, how to structure, relationship to views
3. Complex view logic and testability - keeping presentation logic testable

Planning substep: produce a topic outline with section headings, key examples,
and decision criteria before writing.

**4.2 - New topic: Complex Sequences [PLAN FIRST]**

New guide page(s) covering MVT patterns for complex timed sequences. Three
scenario categories:

1. Multiple mutually-exclusive phases (state machine pattern)
2. Open-ended phases paired with cyclic animations
3. Fully-general complex sequences with overlapping steps and repeated loops

Planning substep: produce a topic outline with scenarios, patterns, and example
sketches before writing.

**4.3 - Expand testing coverage**

The current single `docs/topics/testing.md` page is insufficient. Expand into
multiple pages or a substantially larger single page covering:

- Model testing - patterns, time-stepping helpers, factory-with-defaults
- View testing - scene graph assertions, snapshot testing, mock bindings
- Testing techniques - deterministic time, testing composed models, testing
  sequences
- Testing anti-patterns - what not to test, over-testing internals

May fit under a "Testing" subgroup in the Topics sidebar.

### Phase 5 - Rules revision

**5.1 - Audit and split architecture rules**

Review every rule in `docs/reference/architecture-rules.md` and split them:

- **Universal MVT rules** move to the Architecture section's rules page
  (created in 1.1). These are the transferable constraints any MVT
  implementation must follow.
- **Repo-specific conventions** stay in the Reference section, absorbed into
  the style guide or a separate conventions page.

For each rule:
- Identify whether it's universal MVT or repo-specific
- Identify rules that feel "tacked on" vs essential architectural constraints
- Identify important constraints that are missing and should be rules
- Consider splitting into tiers (e.g. "must" rules vs "should" guidelines)
- Ensure every rule has a clear rationale

**5.2 - Revise rule naming scheme**

The current M1-M5 / V1-V9 numbering is brittle - inserting a rule renumbers
downstream rules, breaking all references. Consider alternatives:

- Descriptive names (like ESLint: `no-wall-clock-time`)
- Numbered with gaps (M10, M20, M30... leaving room for insertions)
- Prefixed codes with semantic meaning

Whatever scheme is chosen, update all references in docs, AGENTS.md, skill
files, and code review checklists.

**5.3 - Propagate rule changes**

After 5.1 and 5.2, update all files that reference rules:
- `docs/ai-agents/skill-code-review.md`
- `docs/topics/common-mistakes.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`

### Phase 6 - Final polish

**6.1 - Cross-link audit**

Walk every page and verify:
- All **Related** / **Next** / **Previous** links are correct
- New pages are linked from relevant siblings
- Glossary has entries for all terms introduced in new/revised pages
- Landing page accurately reflects the final structure

**6.2 - Update AI agent files**

Ensure AGENTS.md and skill files reflect the final docs structure. Verify the
"single canonical source" principle from Phase 1.5 is maintained.

**6.3 - Update site-map.md**

Regenerate the site map artefact in this task directory to reflect the final
docs structure.

## Acceptance Criteria

- [ ] Architecture section created with ~4-6 transferable specification pages
- [ ] Top-level sections renamed to Learn / Topics / Reference / Architecture
- [ ] Landing page diagram/heading mismatch fixed
- [ ] Landing page has "how docs are organized" section
- [ ] Contributing guide relocated out of docs navigation
- [ ] Foundations page integrated into Architecture or another section
- [ ] Topics sidebar has grouped subclusters
- [ ] Agent file duplication reduced to single canonical source
- [ ] Model-view separation explanations strengthened with analogies
- [ ] All code examples audited for clarity and universality
- [ ] All diagrams audited for accuracy and new diagrams added where needed
- [ ] Architecture vs convention callouts used consistently in examples
- [ ] Learn pages have "You will learn" callouts
- [ ] Quickstart page added
- [ ] Key examples link to playground presets
- [ ] llms.txt file added
- [ ] Reactivity guide fully rewritten (polling taxonomy, entry page, condensed)
- [ ] Presentation State guide rewritten (planned, then written)
- [ ] Complex Sequences guide written (planned, then written)
- [ ] Testing coverage expanded
- [ ] Architecture rules split: universal in Architecture, repo-specific in Reference
- [ ] Rule naming scheme revised and references updated
- [ ] Cross-links verified across all pages
- [ ] Site map updated to reflect final structure
- [ ] Final task write-up including next steps (based on future additions not in scope)

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
