# Notes

Planning material for the project: designs not yet built, work to do, and a
record of what is finished. Nothing here describes how the repo currently
works; for that, see [packages/docs/](../packages/docs/index.md) and the README of the module in
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
  guide) moves next to that code or into `packages/docs/`, not into the archive.

**Numbering.** Proposals and tasks share one sequence, so a number identifies
one document wherever it lives, and references such as "004 section 11" stay
valid when it moves. Numbers are never reused. The next free number is
**038**.

**Paths in older notes.** The repo became a workspace of packages on
2026-10-02 (011). Archived notes, and the history recorded in open ones, keep
the paths of their day: `src/mvt-utils/` is now `packages/utils/src/`,
`src/<renderer>-mvt/` is `packages/<renderer>/src/`, `src/common/` is
`packages/website/src/shared/`, and the rest of `src/` is
`packages/website/src/`. The aliases became package names (`#pixi-mvt/jsx`
is `@mvtjs/pixi/jsx`), and `#common` became `#shared`. On 2026-10-04 (036),
`site/` moved to `packages/website/`, `docs/` to `packages/docs/`,
`benchmarks/` to `packages/benchmarks/`, and `checks/` to `packages/checks/`.

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
| 008 | [`Watch()` fluent builder](./proposals/008-watch-builder-spike.md) | Spike. One poll-based `Watch()` chain covering change detection, memoised derivation, reactions and uniform lists. The prototype is `src/common/watch-builder.spike.ts`, not exported from the barrel. Recommends promotion; open questions and promotion work are in its "Handover: loose ends" section |
| 012 | [Performance findings from the falling-sand demo](./proposals/012-falling-sand-performance-findings.md) | Section 2 implemented: each container's method cached in the scene-pass loop (measured 12-27% cheaper refresh on the falling-sand demo, at a small cost on uniform scenes). Still proposed: a mixed-scene variant of the `scaling` benchmark, a docs note on Pixi render-group rebuilds, and a decision on the perfmon's unreliable GPU figure |
| 013 | [Does the MVT architecture limit game performance?](./proposals/013-mvt-performance-ceiling.md) | Analysis, estimated rather than measured. Concludes the architecture's one inherent cost is re-reading presented state every frame, and that the costs measured in this repo come from the implementation. Proposes two falling-sand experiments to test that (section 8) |
| 019 | [Boids that scale](./proposals/019-boids-scaling.md) | Proposed, spiked and measured. A dot-product vision test and a uniform grid make the boids model 2.7-3.8x faster with unchanged behaviour; a nearest-first neighbour limit makes it close to linear (67x at 5000 boids) but changes the flock, so it is recommended as an opt-in slider |
| 022 | [A renderer-agnostic JSX base](./proposals/022-renderer-agnostic-jsx.md) | Phases 1-4 implemented: the base and Pixi's JSX target (measured level with the old runtime), generic scene passes with 012's cached methods, a conformance suite run on every JSX target, three.js, and HTML (measured in headless Chrome), with one demo using both. Its generated refresh code and build-time precompiler were built, then replaced by closures within 1.1-1.3x of their speed, with no `new Function` (section 7.7, task 025). Directories shaped as the future packages (one base, `src/mvt-utils/`, and one per renderer, JSX at `jsx/`); the moves into packages wait for 011. Splits `pixi-jsx` into a base and a Pixi JSX target that is mostly an element table, so HTML and three.js JSX targets reuse the whole runtime, intrinsic elements and `<List>`/`<Switch>` included. Generalises the pixi-mvt passes to any tree. Appraises an earlier spike of the same idea (022a) |
| 023 | [pixi-jsx follow-ups](./proposals/023-jsx-follow-ups.md) | Proposed, a collection of candidates. What is still open from the research session behind 021: `RenderLayer` in place of a portal (needs a spike), a component that rebuilds its subtree on a key and a cross-fade built on it (wait for a view that needs them), window listeners owned by the session (low priority), and findings to send to the workshop |
| 034 | [Neon Monsoon, a 1990s bullet hell scroller](./proposals/034-neon-monsoon-bullet-hell.md) | Implemented, but for a boss replay in the benchmark. A vertical shooter with dense bullet patterns, a focus mode, bombs, chains and a three-phase boss. Its models run on a fixed 60 Hz step with seeded random numbers, keep up to 2048 bullets in typed arrays, and write patterns as data. Measured: 43 µs per model step and 70 µs per bullet-view refresh at 2000 bullets (CPU, Node). Found, and fixed, a gap in `<List>`: it did not skip an empty slot's update step (section 11.4) |
| 035 | [A demoscene demo](./proposals/035-demoscene-demo.md) | Proposed. A non-interactive, looping show in the style of a 1980s C64 demo (raster bars, tech-tech, border scroller, plasma, filled vectors, a 48-sprite multiplexer), drawn through a virtual video chip whose memory carries the hardware's limits. The model is closed-form in show time, so seek is free and the one view holds no state. Music deferred to a later audio view |
| 036 | [The website, and one Arcade for every entry](./proposals/036-website-arcade.md) | Accepted, steps 1-8 implemented: the Arcade runs at `/arcade/` beside the old pages; switching over and the docs (steps 9-10) remain. `site/` becomes `packages/website/`, and `docs/`, `benchmarks/` and `checks/` follow. The cabinet and the demos gallery become one Arcade, the home page, written in HTML JSX: cards in several columns for every entry on any renderer (lazy `pixi` and `element` entries), one search box for names and tags, committed thumbnails, the cabinet's zoom kept. Measured the 5 s first load as serial round trips on a cold CDN edge (thumbnails cost 97 ms of CPU): no loading screen, just a progress bar held in the zoom when loading outlasts it. Also found HTTPS broken on yortus.com. Absorbs task 026 |

**How they relate.** All nine can be read on their own. 022 is the
design 011 section 5.5 deferred until a second renderer, and would land
012's method caching in its generic scene-pass core. 008 concerns
the `watch()` helper (now in `@mvtjs/utils`), and now also whether `memoiseLast`
(from 018, archived) should give way to its mapping terminal. 011 is about the
repo rather than the architecture; its migration moves most of the paths the
other notes cite. 012 changes 001's pass loop and qualifies the `scaling`
numbers from 010's harness. 013 builds on 012's measurements. 019 follows
017's boids allocation fix and touches only the boids demo. 013's
falling-sand experiments were run by 020, now archived. 023 collects what
021 left open; two of its items would be written against 022's base if
022 lands first. 011's publishing phase carries two items from 027, now
archived: guarding against two copies of the scene passes in one program,
and a shared `SKIP_DESCENDANTS` symbol. 031, now archived, renamed the tick
API that 027 named, before 011's first publish. 034 adds a game that
follows the games' originality rules, and tests 013's inherent cost in a
shipping game. 035 adds a demo that follows the same rules. 036 absorbs
task 026, and would list 034 and 035 in its Arcade.

## Tasks

### Active

| # | Task | Priority | Created |
| --- | --- | --- | --- |
| 037 | [Arcade Code Review](tasks/active/037-arcade-code-review.md) | high | 2026-10-05 |

### Backlog

| # | Task | Priority | Created |
| --- | --- | --- | --- |
| 017 | [Miscellaneous Loose Ends](tasks/backlog/017-misc-loose-ends.md) | medium | 2026-09-26 |
| 026 | [Demos Screen for Every Renderer](tasks/backlog/026-demos-screen-for-every-renderer.md) | medium | 2026-09-30 |

## Archive

| # | Document | Completed |
| --- | --- | --- |
| 001 | [Proposal: MVT plugin rework plan](archive/001-mvt-plugin-rework-plan.md) | 2026-09-24 |
| 003 | [Appraisal: MVT plugin spike](archive/003-mvt-plugin-appraisal.md) | 2026-09-18 |
| 004 | [Proposal: index-addressed `<List>`, with `<Switch>`](archive/004-list-proposal.md) | 2026-09-25 |
| 005 | [Proposal: `SlotList<T>`](archive/005-slot-list-proposal.md) | 2026-09-22 |
| 007 | [Proposal: authoring-convention bridge](archive/007-authoring-convention-bridge.md) (superseded by 018) | 2026-09-27 |
| 010 | [Proposal: performance docs](archive/010-performance-docs-proposal.md) | 2026-09-25 |
| 011 | [Proposal: multi-package repo](archive/011-multi-package-repo.md) (`@mvtjs/utils`, `pixi`, `three` and `html` published from an npm workspace, beside private `site`, `docs`, `benchmarks` and `checks`; Changesets and trusted publishing; `@mvtjs/eslint-plugin`; Vite+ trialled, not adopted) | 2026-10-04 |
| 014 | [Review: Kwazy Cactii](archive/014-review-cactii.md) | 2026-04-10 |
| 015 | [Documentation Overhaul](archive/015-documentation-overhaul/task.md) | 2026-04-19 |
| 016 | [Falling Sand Demo](archive/016-falling-sand-demo/task.md) | 2026-09-26 |
| 018 | [Proposal: one view convention](archive/018-one-view-convention.md) | 2026-09-27 |
| 020 | [Proposal: falling sand as an implementation lab](archive/020-falling-sand-variants.md) | 2026-09-27 |
| 021 | [JSX and Teardown Quick Wins](archive/021-jsx-and-teardown-quick-wins.md) | 2026-09-28 |
| 024 | [Merge 022's Changes in Reviewed Steps](archive/024-merge-022-in-steps.md) | 2026-09-30 |
| 025 | [Keep the JSX Precompiler, or Ship Two Builds?](archive/025-precompiler-or-two-builds.md) (decided: neither; one eval-free runtime) | 2026-10-01 |
| 027 | [Proposal: aligning the scene methods with MVT's `update` and `refresh`](archive/027-mvt-method-names.md) (decided: no methods on nodes; the tick API, `setTickMethods` / `tickScene`) | 2026-10-02 |
| 028 | [Move to the Tick API (`tickScene` / `setTickMethods`)](archive/028-tick-api-migration.md) | 2026-10-02 |
| 029 | [Rename `onTick` to `setTickMethods`](archive/029-rename-ontick-to-settickmethods.md) (returns `void`) | 2026-10-02 |
| 030 | [A Self-Describing Perfmon Panel](archive/030-self-describing-perfmon.md) | 2026-10-02 |
| 031 | [Proposal: the tick API in MVT's own words](archive/031-tick-api-in-mvt-terms.md) (`updateView` / `refreshView` and `setUpdate` / `setRefresh`, one set for every renderer; `tickCounter`; `PerformanceMetrics`; "scene pass" retired) | 2026-10-03 |
| 033 | [Fruit Machine Demo](archive/033-fruit-machine-demo/task.md) (one model, four views: Pixi, three.js, an HTML panel and a terminal) | 2026-10-03 |

## Elsewhere

- **002** and **006** turned out to describe shipped code. 002 lives next
  to it, [packages/pixi/src/design-notes.md](../packages/pixi/src/design-notes.md); 006,
  the `<List>` patterns guide, is now the docs page
  [Presenting Collections](../packages/docs/building-with-mvt/presenting-the-world/collections.md).
- **009** was never used.
- Tasks 014-016 were numbered 001-003 before 2026-09-26.
- [Can pull match push?](../packages/docs/articles/can-pull-match-push.md), a write-up
  of the `<List>` design for a general audience, is in `packages/docs/articles/`. It is
  a draft, excluded from the docs build until it is published.
