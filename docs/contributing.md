# Contributing to the Documentation

> How to add to and maintain these docs. Captures the durable principles from
> the original restructure plan so future changes - by humans and AI agents -
> harmonise with the established structure.

**Related:** [Docs Home](index.md) · [AI Agent Orientation](ai-agents/index.md)

---

## Documentation Philosophy

Four principles govern every page in this documentation:

1. **One topic per page.** Each page covers one concept. Target 150-400 lines.
   If a page grows beyond ~400 lines, split it into sub-pages.

2. **Skim-first structure.** Every page opens with a 2-3 sentence summary.
   Tables, diagrams, and callout boxes surface key points for skimmers.
   Detailed explanations follow for those who want depth.

3. **Progressive disclosure.** Content is ordered from simple to complex.
   Each page states its prerequisites and links forward to next steps.
   A reader can stop at any point with a coherent understanding.

4. **Single source of truth.** Each concept is defined in exactly one place.
   Other pages cross-link rather than repeat. The
   [glossary](reference/glossary.md) is the canonical definition for all
   terms.

## Audience Model

### Two audiences

| Audience            | Entry point                  | Primary path                      |
| ------------------- | ---------------------------- | --------------------------------- |
| **Human engineers** | Docs landing page, README    | Learn path or Reference path      |
| **AI agents**       | AGENTS.md, skills files      | Quick reference, then topic pages |

### Two use cases

| Use case      | Structure          | Content style                             |
| ------------- | ------------------ | ----------------------------------------- |
| **Learn**     | Tutorial + Guide   | Sequential, progressive, hands-on         |
| **Reference** | Reference section  | Terse, complete, scannable, linkable      |

### Strategy: shared content, different entry points

The same topic pages serve both learning and reference. The difference is
navigation:

- **Learn path:** A guided reading order with prerequisites. Pages under
  "Building with MVT" are read in sequence, each ending with a "Next:" link.
- **Reference path:** Flat index. Every concept is directly accessible via
  the sidebar, glossary, or search.
- **AI agent path:** AGENTS.md is a compressed orientation that links to
  topic pages. Skills files in `ai-agents/` are self-contained instruction
  sets for specific tasks.

The content itself does not change between paths - only the navigation and
entry point.

## Section Purposes

Use this table to decide where new content belongs:

| Section | What belongs here | Examples |
| --- | --- | --- |
| **building-with-mvt/** | Entry pages for the progressive guide | Quickstart, the game loop |
| **building-with-mvt/simulating-the-world/** | Models, time, composition | Models, time management, model composition |
| **building-with-mvt/presenting-the-world/** | Views, bindings, view composition | Views, bindings, view composition, bindings in depth |
| **building-with-mvt/reacting-to-changes/** | Polling, change detection, events | Why polling, change detection, events and signals |
| **building-with-mvt/adding-visual-polish/** | Presentation state and view models | Presentation state, taming complex views |
| **building-with-mvt/animating-transitions/** | Phase-based, open-ended, sequences | Phase-based transitions, open-ended phases, complex sequences |
| **building-with-mvt/iterating-with-confidence/** | Testing approaches and patterns | Testing, testing models, testing views |
| **building-with-mvt/avoiding-pitfalls/** | Common mistakes and performance | Common mistakes, hot paths |
| **architecture/** | Transferable MVT specification | Overview, models, views, bindings, ticker, rules, heritage |
| **reference/** | Terse, scannable, linkable. Complete coverage. | Architecture rules, style guide, glossary, project structure |
| **ai-agents/** | AI agent orientation and skills files | Agent index, skill-mvt-model, skill-mvt-view |

New guide content goes in the matching content-group directory.
If it is a quick-lookup resource, it belongs in `reference/`.

## Page Template

Every docs page follows this structure:

```markdown
# Page Title

> Brief 2-3 sentence summary of what this page covers.

**Prerequisites:** [Link to prior page] (for learn/ pages)
**Related:** [Link], [Link] (for topics/ and reference/ pages)

---

[Content sections]

---

**Next:** [Link to next page] (for learn/ pages only)
```

Key points:
- The summary is the skim layer. A reader who reads only this line should
  understand the page's scope.
- Guide pages use **Previous** and **Next** links to form a reading chain.
- All pages use **Related** links to connect to siblings and dependencies.

## Tone and Style Rules

Follow this checklist for every page:

- No em-dashes (use hyphens or restructure the sentence)
- Active voice preferred
- Direct sentences (not "It should be noted that..." or "Obviously...")
- Supportive, not condescending ("This keeps things simple" not "As you
  should already know...")
- Code examples use the project's actual TypeScript style
- Technical terms link to the [glossary](reference/glossary.md) on first use
  per page
- Professional, neutral, approachable tone

## MVT Architecture vs Code Style

These are two separate concerns. Keep them clearly distinguished:

- **MVT architecture** (guide pages under Building with MVT): generally
  applicable rules that any codebase using MVT should follow. Examples:
  models own state, views are stateless, the ticker drives time.
- **Code style** (reference/style-guide.md and code examples): conventions
  specific to this repo. Examples: factory functions vs classes, naming
  rules, barrel file structure.

When a page presents code examples:
- State what MVT requires (the architectural constraint).
- Show the example using this repo's conventions.
- Note that the style shown is a convention, not an architectural requirement,
  and link to the style guide for full details.

## Presentation-Agnostic Language

MVT is not tied to Pixi.js. Views could target canvas, DOM, audio, or any
other output.

- Prefer "presentation" over "scene graph", "pixels", or "visual" for
  MVT-level concepts.
- Qualify renderer-specific details. When using Pixi.js constructs, note
  that this is the project's technology choice, not an MVT requirement.
- Use "presentational" rather than "visual" for view output, since not all
  views produce visual output.

## Hot-Path-Safe Code Examples

Code examples should not demonstrate patterns the guide advises against:

- Avoid per-tick heap allocations in `refresh()` examples (template strings,
  `array.map()`, spread operations).
- Prefer examples that assign numeric properties (position, alpha, scale).
- When a text-update example is needed, acknowledge the allocation or show
  change detection to avoid updating every tick.

## GSAP Is Not an MVT Requirement

GSAP paused timelines are one way to meet the `update(deltaMs)` constraint.
Models are free to use any mechanism that advances state through `deltaMs`.

- State the MVT constraint (all state through deltaMs, no wall-clock time).
- Present GSAP patterns as this project's approach, not the only approach.
- In skills files, label GSAP patterns as **project convention**.

## VitePress Compatibility

- Do not use `- [ ]` task list checkboxes - they render as raw text in
  VitePress. Use plain list items instead.
- Use VitePress containers (`::: info`, `::: warning`) for callouts.
- Verify Mermaid diagrams render in the VitePress build.

## Adding a New Page

1. **Choose the section** using the section purposes table above.
2. **Create the file** using the page template. Use `lower-kebab-case.md`
   file naming.
3. **Keep it focused.** One topic per page, 150-400 lines target.
4. **Add glossary entries** in [reference/glossary.md](reference/glossary.md)
   for any new terms.
5. **Cross-link from related pages.** Add the new page to the **Related**
   line of sibling pages.
6. **Update the sidebar** in the VitePress configuration.
7. **For guide pages:** update the **Next** link on the previous page and
   the **Previous** link on the page itself.

## Updating Existing Pages

- Keep pages under ~400 lines. Split if a page is growing beyond that.
- Maintain the skim layer (summary, tables, diagrams).
- Update cross-links when renaming or moving pages.
- If a term's definition changes, update the glossary first, then update
  all pages that reference the term.

## Keeping AI Agent Files in Sync

When architecture rules or conventions change, update these files:

1. **AGENTS.md** (repo root) - compressed orientation
2. **docs/ai-agents/index.md** - expanded agent orientation
3. **Relevant skills file** in `docs/ai-agents/skill-*.md`
4. **docs/reference/architecture-rules.md** - if an architecture rule changed
5. **docs/reference/style-guide.md** - if a code convention changed

All five share overlapping content. A change to one likely requires a
corresponding change to the others.

## Diagram Conventions

Use Mermaid for all diagrams. Each diagram should convey something prose
alone cannot - do not add decorative diagrams.

Current diagram inventory:

| Diagram | Page | Type |
| --- | --- | --- |
| MVT frame loop | building-with-mvt/the-game-loop.md | Mermaid flowchart |
| Component summary | building-with-mvt/the-game-loop.md | Markdown table |
| Bindings data flow | building-with-mvt/presenting-the-world/bindings.md | Mermaid sequence diagram |
| Model tree | building-with-mvt/simulating-the-world/model-composition.md | Mermaid graph |
| View tree | building-with-mvt/presenting-the-world/view-composition.md | Mermaid graph |
| Barrel import rules | reference/project-structure.md | Mermaid flowchart |
| Ticker frame sequence | building-with-mvt/the-game-loop.md | Mermaid sequence diagram |
| Pattern reinforcement | architecture/heritage.md | Mermaid flowchart |
| Real game model/view tree | (removed) | Mermaid graph |

Before adding a new diagram, check this list to avoid duplicating an
existing one. When you add a diagram, add it to this table.
