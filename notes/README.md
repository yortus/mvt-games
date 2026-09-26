# Notes

Planning material for the project: designs not yet built, work to do, and a
record of what is finished. Nothing here describes how the repo currently
works; for that, see [docs/](../docs/index.md) and the README of the module in
question.

```
notes/
├── proposals/       Designs not yet implemented, awaiting a decision or the work
├── tasks/
│   ├── backlog/     Agreed work, not started
│   └── active/      Work in progress
└── archive/         Everything finished or abandoned, proposals and tasks alike
```

## How It Works

**A proposal** answers "should we, and how?". It argues for a design, records
what was measured or tried, and ends with open questions and implementation
steps. **A task** says "do this". It has a checklist of acceptance criteria and
a progress log.

- A proposal stays in `proposals/` while it is open, including while it is
  being implemented. Keep its **Status** line current as the work lands.
- Pick up a task by moving it from `tasks/backlog/` to `tasks/active/`. Update
  its progress log as you go.
- When a proposal or task is finished, or abandoned, move it to `archive/` and
  update the index below. Put any loose ends in a task, or in an existing one.
- A document that turns out to describe shipped code (design notes, a usage
  guide) moves next to that code or into `docs/`, not into the archive.

**Numbering.** Proposals and tasks share one sequence, so a number identifies
one document wherever it lives, and references such as "004 section 11" stay
valid when it moves. Numbers are never reused. The next free number is
**018**.

A document is a single file (`NNN-short-name.md`), or a folder
(`NNN-short-name/`) when it needs more than one file; a task folder's main file
is `task.md`.

### Writing a proposal

Start from the shape the existing proposals share:

1. A `# Proposal: ...` title and a one-paragraph summary in a quote block.
2. **Status:** proposed, spike, implemented in part, and so on. Say what is
   done and what is not.
3. **Written:** the date, and what it was measured or checked against.
4. **Related:** links to the code, docs and other notes it depends on.
5. A summary table of the decisions or recommendations, each pointing to the
   section that argues it.
6. Numbered sections, so other documents can cite "011 section 6.3".
7. Open questions, then implementation steps. Strike steps through as they
   are done (`~~Step.~~ Done.`) rather than deleting them.

Record settled questions and ruled-out hypotheses explicitly, marked "do not
reopen without new information", so a later session does not repeat the work.

### Writing a task

A task file has a field table (Priority, Created, Updated), a Description, an
Acceptance Criteria checklist and a dated Progress Log. See
[017](tasks/backlog/017-misc-loose-ends.md) for an example.

## Proposals

| # | Proposal | Status |
| --- | --- | --- |
| 007 | [Authoring-convention bridge](./proposals/007-authoring-convention-bridge.md) | Proposed. A strongly-typed key-rename transform between imperative `bindings` views and JSX `props` views, so each is authored in its own idiom and consumed under the other |
| 008 | [`Watch()` fluent builder](./proposals/008-watch-builder-spike.md) | Spike. One poll-based `Watch()` chain covering change detection, memoised derivation, reactions and uniform lists. The prototype is `src/common/watch-builder.spike.ts`, not exported from the barrel. Recommends promotion; open questions and promotion work are in its "Handover: loose ends" section |
| 011 | [Multi-package repo](./proposals/011-multi-package-repo.md) | Proposed, with its top-level tidy-up already done. Splits the libraries into `@mvtjs/utils` and `@mvtjs/pixi` in a pnpm workspace, with the games, demos and playground as one private `site` package. Includes a tooling briefing, a Vite+ lint trial, and a phased migration plan. Also records a barrel-rule bug in ESLint (section 11.1), left for its phase 1 |
| 012 | [Performance findings from the falling-sand demo](./proposals/012-falling-sand-performance-findings.md) | Proposed. Caching each container's method in the pixi-mvt pass loop (prototyped: 30-40% cheaper refresh in mixed scenes), a mixed-scene variant of the `scaling` benchmark, a docs note on Pixi render-group rebuilds, and a decision on the perfmon's unreliable GPU figure |
| 013 | [Does the MVT architecture limit game performance?](./proposals/013-mvt-performance-ceiling.md) | Analysis, estimated rather than measured. Concludes the architecture's one inherent cost is re-reading presented state every frame, and that the costs measured in this repo come from the implementation. Proposes two falling-sand experiments to test that (section 8) |

**How they relate.** All five can be read on their own. 007 builds on the
pixi-mvt plugin (001) and touches the `<List>` JSX runtime (004). 008 concerns
the `watch()` helper in `src/common/`. 011 is about the repo rather than the
architecture; its migration moves most of the paths the other notes cite. 012
changes 001's pass loop and qualifies the `scaling` numbers from 010's
harness. 013 builds on 012's measurements.

## Tasks

### Active

(none)

### Backlog

| # | Task | Priority | Created |
| --- | --- | --- | --- |
| 017 | [Miscellaneous Loose Ends](tasks/backlog/017-misc-loose-ends.md) | medium | 2026-09-26 |

## Archive

| # | Document | Completed |
| --- | --- | --- |
| 001 | [Proposal: MVT plugin rework plan](archive/001-mvt-plugin-rework-plan.md) | 2026-09-24 |
| 003 | [Appraisal: MVT plugin spike](archive/003-mvt-plugin-appraisal.md) | 2026-09-18 |
| 004 | [Proposal: index-addressed `<List>`, with `<Switch>`](archive/004-list-proposal.md) | 2026-09-25 |
| 005 | [Proposal: `SlotList<T>`](archive/005-slot-list-proposal.md) | 2026-09-22 |
| 010 | [Proposal: performance docs](archive/010-performance-docs-proposal.md) | 2026-09-25 |
| 014 | [Review: Kwazy Cactii](archive/014-review-cactii.md) | 2026-04-10 |
| 015 | [Documentation Overhaul](archive/015-documentation-overhaul/task.md) | 2026-04-19 |
| 016 | [Falling Sand Demo](archive/016-falling-sand-demo/task.md) | 2026-09-26 |

## Elsewhere

- **002** and **006** turned out to describe shipped code, so they live next
  to it: [src/pixi-mvt/design-notes.md](../src/pixi-mvt/design-notes.md) and
  [src/pixi-jsx/list-patterns.md](../src/pixi-jsx/list-patterns.md).
- **009** was never used.
- Tasks 014-016 were numbered 001-003 before 2026-09-26.
- [Can pull match push?](../docs/articles/can-pull-match-push.md), a write-up
  of the `<List>` design for a general audience, is in `docs/articles/`. It is
  a draft, excluded from the docs build until it is published.
