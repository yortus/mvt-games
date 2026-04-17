# Skill: Writing and Updating Documentation

> Self-contained instructions for AI agents making updates to any part of
> the MVT documentation. Load this file before writing or modifying docs.

---

## Documentation Structure

The docs are organized into six sections. Place new content in the right one:

| Section | Purpose | Content style |
| --- | --- | --- |
| **learn/** | Sequential introduction to MVT | Progressive, builds on previous pages |
| **topics/** | In-depth topic pages (any order) | Self-contained, detailed, with prerequisites |
| **reference/** | Quick-lookup resources | Terse, scannable, complete |
| **foundations/** | MVT's pattern heritage | Academic, connecting to established patterns |
| **reactivity/** | Reactivity strategies deep-dive | Supplementary, not required for MVT |
| **ai-agents/** | Agent orientation and skills files | Compressed, task-oriented |

## Page Template

Every docs page must follow this structure:

```markdown
# Page Title

> Brief 2-3 sentence summary of what this page covers.

**Prerequisites:** [Link to prior page] (learn/ pages only)
**Related:** [Link], [Link] (topics/ and reference/ pages)

---

[Content sections]

---

**Next:** [Link to next page] (learn/ pages only)
```

- The summary line is mandatory. It is the skim layer - a reader who reads
  only this should understand the page's scope.
- `learn/` pages use **Prerequisites** and **Next** to form a chain.
- `topics/` and `reference/` pages use **Related** to connect to siblings.

## Writing Rules

### Tone

- Professional, neutral, approachable. Supportive mentor tone.
- Active voice. Direct sentences.
- No em-dashes - use hyphens or restructure the sentence.
- No hedging ("It should be noted that...") or condescension ("Obviously...").
- No marketing language.

### Structure

- **One topic per page.** Target 150-400 lines. Split if growing beyond ~400.
- **Skim-first.** Open with summary, use tables for comparisons and rules,
  keep code examples short and annotated.
- **Progressive disclosure.** Simple concepts before complex ones. State
  prerequisites. Link forward to advanced topics.
- **Single source of truth.** Define each concept in one place. Cross-link
  rather than repeat.

### Technical Terminology

- Link to the [glossary](../reference/glossary.md) on first use of a
  technical term per page.
- When introducing a new term, add it to the glossary.
- Use consistent terminology across all pages (e.g. "presentation" not
  "rendering" for MVT-level concepts).

## Key Distinctions

### MVT Architecture vs Code Style

These are separate concerns. Never conflate them:

- **MVT architecture:** generally applicable rules (models own state, views
  are stateless, ticker drives time). Documented in `learn/` and `topics/`.
- **Code style:** conventions specific to this repo (factory functions, naming
  rules, barrel files). Documented in `reference/style-guide.md`.

When showing code examples:
1. State what MVT requires.
2. Show the example using this repo's conventions.
3. Note that the style is a project convention, not an MVT requirement.

### Presentation-Agnostic Language

MVT is not tied to Pixi.js. Use neutral terms at the MVT level:

| Prefer | Over | When |
| --- | --- | --- |
| presentation | scene graph, pixels, visual | Describing MVT concepts |
| presentational | visual | Categorizing view output |
| presentation output | rendered frame | General view descriptions |

Use renderer-specific terms only in Pixi-specific sections, and note they
are technology choices.

### GSAP Is a Convention, Not a Requirement

GSAP paused timelines are one way to meet the `update(deltaMs)` constraint.
Always:
- State the MVT constraint (all state through `deltaMs`).
- Present GSAP as this project's approach, not the only approach.
- Label GSAP patterns as **[project convention]** in skills files.

## Code Examples in Documentation

### Hot-Path Safety

Do not write examples that violate the project's own hot-path advice:

- No per-tick allocations in `refresh()` examples (template strings,
  `array.map()`, spread, `for...of`).
- Prefer assigning numeric properties (position, alpha, scale).
- If a text-update example is needed, acknowledge the allocation or use
  change detection.

### Style Compliance

Code examples must follow the project's code conventions:

- Factory functions, not classes
- 4-space indentation
- `camelCase` variables, `PascalCase` types
- String-literal unions, not enums
- `undefined`, not `null`

## Cross-Linking Checklist

When adding or modifying a page:

1. Add the page to **Related** lines on sibling pages.
2. For `learn/` pages, update **Next** on the previous page and
   **Prerequisites** on the new page.
3. Add new terms to [reference/glossary.md](../reference/glossary.md).
4. Update the sidebar in the VitePress configuration.
5. Check that all internal links resolve (no broken references).

## Keeping AI Agent Files in Sync

When architecture rules or conventions change, update all of these:

| File | What to update |
| --- | --- |
| AGENTS.md | Compressed orientation at repo root |
| docs/ai-agents/index.md | Expanded agent orientation |
| docs/ai-agents/skill-*.md | Relevant skills file(s) |
| docs/reference/architecture-rules.md | If an architecture rule changed |
| docs/reference/style-guide.md | If a code convention changed |

These files share overlapping content. A change to one likely requires
corresponding changes to the others.

## Diagram Conventions

Use Mermaid for all diagrams. Each diagram must convey information that prose
alone cannot - no decorative diagrams.

Before adding a new diagram, check the inventory in
[contributing.md](../contributing.md) to avoid duplicating an existing one.
When you add a diagram, update that inventory.

## VitePress Compatibility

- No `- [ ]` checkboxes - they render as raw text. Use plain list items.
- Use VitePress containers (`::: info`, `::: warning`) for callouts.
- Verify Mermaid diagrams render correctly.

## Full Reference

- [Contributing Guide](../contributing.md) - complete documentation
  conventions and maintenance guidelines
