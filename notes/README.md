# Notes

Planning material for the project: designs not yet built, work to do, and a
record of what is finished. Nothing here describes how the repo currently
works; for that, see [packages/sites/docs/](../packages/sites/docs/index.md) and the README of the module in
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
  guide) moves next to that code or into `packages/sites/docs/`, not into the archive.

**Numbering.** Proposals and tasks share one sequence, so a number identifies
one document wherever it lives, and references such as "004 section 11" stay
valid when it moves. Numbers are never reused. The next free number is
**118**. 085 was set aside for a worktree and never used, 115 is taken
by a proposal on the `timelines` branch, and 116 is left for a note
written on another computer.

**Paths in older notes.** The repo became a workspace of packages on
2026-10-02 (011). Archived notes, and the history recorded in open ones, keep
the paths of their day: `src/mvt-utils/` is now `packages/libraries/utils/src/`,
`src/<renderer>-mvt/` is `packages/<renderer>/src/`, `src/common/` is
`packages/sites/arcade/src/shared/`, and the rest of `src/` is
`packages/sites/arcade/src/`. The aliases became package names (`#pixi-mvt/jsx`
is `@mvtjs/pixi/jsx`), and `#common` became `#shared`. On 2026-10-04 (036),
`site/` moved to `packages/sites/arcade/`, `docs/` to `packages/sites/docs/`,
`benchmarks/` to `packages/tests/benchmarks/`, and `checks/` to `packages/tests/checks/`. Later
that day, the website's `src/games/<id>/` and `src/demos/<id>/` became
`src/entries/<id>/`, its `src/catalogue/` moved into `src/entries/`, and the
entry types' `src/entries/` became `src/entry-types/`. On 2026-10-16, the
packages were grouped into `packages/libraries/`, `tools/`, `sites/` and
`tests/`, and then the website, `packages/sites/website/` (`@mvtjs/website`),
was renamed `packages/sites/arcade/` (`@mvtjs/arcade`), as the first step of
052. On 2026-10-29, the groups became `libraries/` (everything published),
`sites/` and `internal/`: `tools/v-snap/` moved to `libraries/v-snap/`, and
`tools/eslint-plugin/`, `tests/benchmarks/` and `tests/checks/` to
`internal/`. On 2026-11-01 (084), the Arcade split into three sites,
`packages/sites/arcade/` (its games), `demos/` and `puzzles/`, and what they
share moved to `packages/sites/site-kit/`: the Arcade's `src/arcade/`,
`src/runner/`, `src/shared/`, `src/entry-types/` and the rest but the
entries, most of `scripts/` (its `main.ts` became `start-site-page.ts`, and
`run-dev-servers.ts` became `run-dev-server.ts`), and `highscores-worker/`.
`#shared` and the other aliases became `@mvtjs/site-kit/shared` and so on,
and `#sudoku-digger` became `@mvtjs/puzzles/sudoku-generator`.

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
| 012 | [Performance findings from the falling-sand demo](./proposals/012-falling-sand-performance-findings.md) | Section 2 implemented: each container's method cached in the scene-pass loop (measured 12-27% cheaper refresh on the falling-sand demo, at a small cost on uniform scenes). Still proposed: a mixed-scene variant of the `scaling` benchmark, a docs note on Pixi render-group rebuilds, and a decision on the perfmon's unreliable GPU figure |
| 019 | [Boids that scale](./proposals/019-boids-scaling.md) | Proposed, spiked and measured. A dot-product vision test and a uniform grid make the boids model 2.7-3.8x faster with unchanged behaviour; a nearest-first neighbour limit makes it close to linear (67x at 5000 boids) but changes the flock, so it is recommended as an opt-in slider |
| 023 | [pixi-jsx follow-ups](./proposals/023-jsx-follow-ups.md) | Proposed, a collection of candidates. What is still open from the research session behind 021: `RenderLayer` in place of a portal (needs a spike), a component that rebuilds its subtree on a key and a cross-fade built on it (wait for a view that needs them), window listeners owned by the session (low priority), and findings to send to the workshop |
| 035 | [A demoscene demo](./proposals/035-demoscene-demo.md) | Built on the `demoscene-demo` branch (steps 1-6, last changed 2026-10-06), never merged. Reviews there recommend keeping it for reference and rebuilding a smaller show of four parts. Waiting on a decision: rebuild it smaller, or drop it. A non-interactive, looping show in the style of a 1980s C64 demo (raster bars, tech-tech, border scroller, plasma, filled vectors, a 48-sprite multiplexer), drawn through a virtual video chip whose memory carries the hardware's limits. The model is closed-form in show time, so seek is free and the one view holds no state |
| 069 | [A line length of 120, and single-line imports](./proposals/069-line-length-and-single-line-imports.md) | Proposed. Four stages: write down 120, enforce it with `@stylistic/max-len` (1,045 lines to fix by hand, a package at a time), add `@mvtjs/single-line-imports`, which writes each import and re-export on one line by a cascade of merge, split values from types, then split by length, and turn it on with `lint:fix` (about 180 files) |
| 077 | [Audio90 Studio](./proposals/077-audio90-studio.md) | Stage 1 (the sound designer) built in the `studio` worktree, uncommitted, awaiting a playtest; it predates the three-site split, so it needs redoing against the site kit to merge. An editor for `audio90`'s sounds and songs, built with MVT, as a private site at `/studio/` beside the playground, depending on `audio90` by its npm name. Four stages, each worth shipping: a sound designer for either chip (presets, sliders, randomise, mutate, export as code), an engine editor for the Audio90's engines with a scope and the keyboard as a piano, a tracker made from the Tune Tracker's views, and sharing (a song in a link, Open in Playground, WAV). Grown from 074 section 8 |
| 080 | [The Audio80's voices inside the Audio90](./proposals/080-audio80-voices-in-the-audio90.md) | Proposed. One chip kind: the Audio90's voices 0-3 become the Audio80, run unchanged with its own output stage so its sounds stay byte-identical, and voices 4-15 stay Audio90 voices (4 + 12, since no song uses more than 10). Two stages first, each worth doing on its own: chips that rest while silent, and one meaning for each tracker token (`f` keeps brightness). Then songs of one kind, the ten Audio80 entries moved, and the `Audio80` chip deprecated; mixed songs later |
| 083 | [Tock, MVT for web apps](./proposals/083-tock-mvt-for-web-apps.md) | Proposed. A rival to React and Vue built on MVT: the same models, views and bindings, with an app ticker that ticks on demand (input, async results, models' deadlines, while animating) so an idle page costs nothing. Keyed lists with cleanup scopes, form bindings, async delivery, a router model, recording and replay; `@mvtjs/widgets` (a model and an accessible view per widget); a Tock site and a docs track; js-framework-benchmark plus our own suites against React, Vue, Solid and Svelte. Stage 0 is a spike with go or no-go hypotheses |
| 103 | [Timelines, animations and players](./proposals/103-timelines-animations-and-players.md) | Draft, for discussion. Replaces `createSequence`, `createSequenceTracker` and `createEdgeTween` with three layers: a stateless timeline of phases and steps (durations, `after` chaining, repeat, yoyo, instant steps), a stateless animation mapping steps to container properties (keyframes, eases on each key, `autoAlpha`, formulas), and a stateful player (`play`, `update`, `apply`) for the common case. Data first, for later import and export. Worked examples port Kwazy Cactii, Fuel Run and the pointer walkthrough |
| 109 | [gamefab, an indie game maker (working title)](./proposals/109-indie-game-maker.md) | Proposed, not yet built. A maker for small 2D web games that works like a software factory you sit inside: the spec is the source, held-out scenarios on headless models and a ladder of graders (checks, scenarios, bot simulations, budgets, look, review, people) decide when a change is done, in two speeds, Pair and Run. Playtest notes are pinned to a tick with an exact replay, and become scenarios. Genre cartridges (incremental, platformer, shooter and so on) are half the work: you grow them alongside each game, a curator proposes lifts from game to cartridge, every game becomes a cartridge brief, and a game can use and grow several at once. Works with the user's own coding agent on their own plan: the Maker's host serves an MCP server for the tools, skills carry the guidance, and one browser window holds the control room, preview and editors. Agent adapters start turns from playtest notes and the queue; T3 Code comes first (its `t3 thread` command, and its browser panel to show the window beside the chat), and can be replaced by a plain fallback or ACP. Not a VS Code fork. Needs a publishable game kit, lint plugin and headless runner first. The game kit includes a game UI kit for players, such as title, pause, settings and highscore screens. The Maker window's widgets follow 083's widget design without needing Tock. Stage 0 is a go or no-go spike |
| 110 | [Docs for game makers and their agents](./proposals/110-docs-for-makers-and-their-agents.md) | Proposed. The book becomes docs again, for 109's makers and their agents rather than a sceptic: about 45,000 words, grouped as Start, Guide, Renderers, Recipes, Working with Agents, Reference and Background, with no numbering or PDF. Leads with exact replays, checks agents run, rules in lint and time control, and stops arguing for polling. Four pages are marked as settling, one home each: the view tick API, timelines and animation (103), sound cues and banks, PixiJS 3D (107). "Placeholder" for provisional content and values, "stand-in" for test doubles. Lint rules link to their docs pages. Six stages: stages 0 and 1 can start now that `pixi-3d` has merged |
| 117 | [Robofleet, an action game on a ship of rogue robots (working title)](./proposals/117-robofleet/proposal.md) | Proposed, nothing built. Our first "real" arcade game, inspired by Paradroid: you're a core that takes over robots and wears their bodies, and each encounter is a choice of fight, take over or hide, on dark decks with a rumbling, 1980s CRT feel. Plans the first playable (one deck, four robot classes, sight and noise, the Signal Lock takeover minigame, energy), built with placeholders to find the fun first, while trying 109's specs, replays and scenarios and noting what 110's pages need. Every other idea is parked in [ideas.md](./proposals/117-robofleet/ideas.md), tagged by milestone |

**How they relate.** All of them can be read on their own. 022 is the
design 011 section 5.5 deferred until a second renderer, and would land
012's method caching in its generic scene-pass core. 011 is about the
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
shipping game. 035 adds a demo that follows the same rules, and would be an
entry in the Arcade that 036, now archived, built. 042, now archived, reused 036's
thumbnail code to give every entry a visual test, and made true what 015's
testing docs already describe. 045, now archived, built the sound chip that
035's music can play on, which 035's section 8 deferred. It gave `watch` its
`increased` and `decreased`, which task 079 kept.
046, now archived, added to what a session gives its host, as 045 added
to what the host gives a session, and built on 036's Arcade.
051, now archived, added a second chip beside 045's, and changed what 045
made the host give every session into a chip each entry chooses. Its Sound
Test demo was 048's idea, and it rescored 034's game.
052, now archived, moved the playground out of the package that 036 made,
added it to 011's workspace, and renamed what was left after 036's Arcade.
A project can play the chip that 045 built, or the one 051 chooses. Its
loose ends are tasks 057 to 064. 068, now archived, moved the music player
that 045 built, and 051 extended, onto the audio thread. 074 makes the
package that holds both chips a standalone one, and builds on 068's
sequencer for one clock, the sound card's. 070, now archived,
touched only the docs, and its tasks 071 to 073 bring the code in line with
its pages. Task 079, now archived, replaced `watch` and `memoiseLast` (018,
archived) with `watch`, `createReaction` and `createComputed`, superseding 008
and 078, both archived, and the `derive` spike on the `derive-util` branch, now
deleted.

## Tasks

### Active

| # | Task | Priority | Created |
| --- | --- | --- | --- |
| 098 | [Input Follow-Ons](tasks/active/098-input-follow-ons.md) | medium | 2026-11-13 |

### Backlog

| # | Task | Priority | Created |
| --- | --- | --- | --- |
| 017 | [Miscellaneous Loose Ends](tasks/backlog/017-misc-loose-ends.md) | medium | 2026-09-26 |
| 038 | [HTML JSX Runtime: Findings from the Arcade](tasks/backlog/038-html-jsx-findings-from-the-arcade.md) | medium | 2026-10-05 |
| 040 | [Touch Controls in HTML](tasks/backlog/040-html-touch-controls.md) | low | 2026-10-05 |
| 048 | [Sound: Follow-Ons From the Audio80](tasks/backlog/048-sound-follow-ons.md) | low | 2026-10-09 |
| 049 | [Highscores: Follow-Ons](tasks/backlog/049-highscores-follow-ons.md) | low | 2026-10-15 |
| 050 | [Visitor Analytics: Who Comes, and From Where](tasks/backlog/050-visitor-analytics.md) | low | 2026-10-15 |
| 054 | [Smooth Window Resizes While an Entry Plays](tasks/backlog/054-smooth-window-resizes.md) | low | 2026-10-16 |
| 057 | [Open an Arcade Entry in the Playground, From GitHub](tasks/backlog/057-open-arcade-entries-in-the-playground.md) | medium | 2026-10-17 |
| 058 | [Playground: Swap the Views, Keep the Model](tasks/backlog/058-swap-views-keep-the-model.md) | medium | 2026-10-17 |
| 059 | [Playground: Port a Project to an Arcade Entry](tasks/backlog/059-port-a-project-to-an-arcade-entry.md) | low | 2026-10-17 |
| 060 | [Playground: The Architecture's Rules as Live Diagnostics](tasks/backlog/060-architecture-rules-as-live-diagnostics.md) | low | 2026-10-17 |
| 062 | [Check the Playground on Real Phones and in Safari](tasks/backlog/062-playground-on-phones-and-safari.md) | medium | 2026-10-17 |
| 063 | [Playground: Shortcuts While the Preview Has the Keyboard](tasks/backlog/063-playground-shortcuts-while-the-preview-has-focus.md) | low | 2026-10-17 |
| 065 | [Audio90: Follow-Ons](tasks/backlog/065-audio90-follow-ons.md) | low | 2026-10-17 |
| 071 | [Throw on Broken Preconditions](tasks/backlog/071-throw-on-broken-preconditions.md) | medium | 2026-10-06 |
| 072 | [Update and Refresh Method Names](tasks/backlog/072-update-and-refresh-method-names.md) | low | 2026-10-15 |
| 073 | [Models Take Their Random Source](tasks/backlog/073-models-take-their-random-source.md) | medium | 2026-10-15 |
| 076 | [audio90: Gaps in the API](tasks/backlog/076-audio90-api-gaps.md) | low | 2026-10-29 |
| 086 | [The Three Sites and Their Themes: Follow-Ons](tasks/backlog/086-site-and-theme-follow-ons.md) | low | 2026-11-01 |
| 090 | [The Book: Follow-Ons](tasks/backlog/090-book-follow-ons.md) | low | 2026-11-01 |
| 093 | [Enforce the Tick Rules](tasks/backlog/093-enforce-the-tick-rules.md) | low | 2026-11-07 |
| 097 | [`@mvtjs/three`'s Pointer Picker: a Cancel, and One Pointer](tasks/backlog/097-three-pointer-picker-cancel-and-pointer-id.md) | low | 2026-11-13 |
| 105 | [The Puzzles' Game Model, Undo and Seeds, in Shared](tasks/backlog/105-puzzle-models-in-shared.md) | low | 2026-11-20 |
| 111 | [Publish `@mvtjs/pixi-3d`](tasks/backlog/111-publish-pixi-3d.md) | low | 2026-11-22 |
| 112 | [An HTML `PixiCanvasView`](tasks/backlog/112-html-pixi-canvas-view.md) | low | 2026-11-22 |
| 114 | [v-snap: Loose Ends From Comparing Across Shader Compilers](tasks/backlog/114-v-snap-shader-compiler-loose-ends.md) | low | 2026-11-24 |

## Archive

| # | Document | Completed |
| --- | --- | --- |
| 001 | [Proposal: MVT plugin rework plan](archive/001-mvt-plugin-rework-plan.md) | 2026-09-24 |
| 003 | [Appraisal: MVT plugin spike](archive/003-mvt-plugin-appraisal.md) | 2026-09-18 |
| 004 | [Proposal: index-addressed `<List>`, with `<Switch>`](archive/004-list-proposal.md) | 2026-09-25 |
| 005 | [Proposal: `SlotList<T>`](archive/005-slot-list-proposal.md) | 2026-09-22 |
| 007 | [Proposal: authoring-convention bridge](archive/007-authoring-convention-bridge.md) (superseded by 018) | 2026-09-27 |
| 008 | [Proposal: `Watch()` fluent builder (spike)](archive/008-watch-builder-spike.md) (superseded by task 079) | 2026-10-25 |
| 010 | [Proposal: performance docs](archive/010-performance-docs-proposal.md) | 2026-09-25 |
| 011 | [Proposal: multi-package repo](archive/011-multi-package-repo.md) (`@mvtjs/utils`, `pixi`, `three` and `html` published from an npm workspace, beside private `site`, `docs`, `benchmarks` and `checks`; Changesets and trusted publishing; `@mvtjs/eslint-plugin`; Vite+ trialled, not adopted) | 2026-10-04 |
| 013 | [Analysis: does the MVT architecture limit game performance?](archive/013-mvt-performance-ceiling.md) (estimated rather than measured. Concludes the architecture's one inherent cost is re-reading presented state every frame, and that the costs measured in this repo come from the implementation. Proposes two falling-sand experiments to test that (section 8)) | 2026-10-16 |
| 014 | [Review: Kwazy Cactii](archive/014-review-cactii.md) | 2026-04-10 |
| 015 | [Documentation Overhaul](archive/015-documentation-overhaul/task.md) | 2026-04-19 |
| 016 | [Falling Sand Demo](archive/016-falling-sand-demo/task.md) | 2026-09-26 |
| 017a | [Miscellaneous Loose Ends: Finished](archive/017a-misc-loose-ends-done.md) (the finished items of 017, split out of it) | 2026-10-18 |
| 018 | [Proposal: one view convention](archive/018-one-view-convention.md) | 2026-09-27 |
| 020 | [Proposal: falling sand as an implementation lab](archive/020-falling-sand-variants.md) | 2026-09-27 |
| 021 | [JSX and Teardown Quick Wins](archive/021-jsx-and-teardown-quick-wins.md) | 2026-09-28 |
| 022 | [Proposal: a renderer-agnostic JSX base](archive/022-renderer-agnostic-jsx.md) (phases 1-4 implemented: the base and Pixi's JSX target (measured level with the old runtime), generic scene passes with 012's cached methods, a conformance suite run on every JSX target, three.js, and HTML (measured in headless Chrome), with one demo using both. Its generated refresh code and build-time precompiler were built, then replaced by closures within 1.1-1.3x of their speed, with no `new Function` (section 7.7, task 025). Directories shaped as the future packages (one base, `src/mvt-utils/`, and one per renderer, JSX at `jsx/`); the moves into packages wait for 011. Splits `pixi-jsx` into a base and a Pixi JSX target that is mostly an element table, so HTML and three.js JSX targets reuse the whole runtime, intrinsic elements and `<List>`/`<Switch>` included. Generalises the pixi-mvt passes to any tree. Appraises an earlier spike of the same idea (022a)) | 2026-10-16 |
| 024 | [Merge 022's Changes in Reviewed Steps](archive/024-merge-022-in-steps.md) | 2026-09-30 |
| 025 | [Keep the JSX Precompiler, or Ship Two Builds?](archive/025-precompiler-or-two-builds.md) (decided: neither; one eval-free runtime) | 2026-10-01 |
| 026 | [Demos Screen for Every Renderer](archive/026-demos-screen-for-every-renderer.md) (absorbed by 036's Arcade) | 2026-10-05 |
| 027 | [Proposal: aligning the scene methods with MVT's `update` and `refresh`](archive/027-mvt-method-names.md) (decided: no methods on nodes; the tick API, `setTickMethods` / `tickScene`) | 2026-10-02 |
| 028 | [Move to the Tick API (`tickScene` / `setTickMethods`)](archive/028-tick-api-migration.md) | 2026-10-02 |
| 029 | [Rename `onTick` to `setTickMethods`](archive/029-rename-ontick-to-settickmethods.md) (returns `void`) | 2026-10-02 |
| 030 | [A Self-Describing Perfmon Panel](archive/030-self-describing-perfmon.md) | 2026-10-02 |
| 031 | [Proposal: the tick API in MVT's own words](archive/031-tick-api-in-mvt-terms.md) (`updateView` / `refreshView` and `setUpdate` / `setRefresh`, one set for every renderer; `tickCounter`; `PerformanceMetrics`; "scene pass" retired) | 2026-10-03 |
| 033 | [Fruit Machine Demo](archive/033-fruit-machine-demo/task.md) (one model, four views: Pixi, three.js, an HTML panel and a terminal) | 2026-10-03 |
| 034 | [Proposal: Neon Monsoon, a 1990s bullet hell scroller](archive/034-neon-monsoon-bullet-hell.md) (implemented, but for a boss replay in the benchmark. A vertical shooter with dense bullet patterns, a focus mode, bombs, chains and a three-phase boss. Its models run on a fixed 60 Hz step with seeded random numbers, keep up to 2048 bullets in typed arrays, and write patterns as data. Measured: 43 µs per model step and 70 µs per bullet-view refresh at 2000 bullets (CPU, Node). Found, and fixed, a gap in `<List>`: it did not skip an empty slot's update step (section 11.4)) | 2026-10-16 |
| 036 | [Proposal: the website, and one Arcade for every entry](archive/036-website-arcade.md) (`site/` became `packages/sites/arcade/`, with `docs/`, `benchmarks/` and `checks/` beside it; the cabinet and the demos gallery became one Arcade, the home page, in HTML JSX: a search with tag tokens, a card wall in columns, committed thumbnails, a burn and power-on transition, and attract mode; every game and demo an entry in `src/entries/`, Pixi or `element`, hosted in one loop; a size budget on the home page. Absorbed task 026; loose ends are tasks 038-041) | 2026-10-05 |
| 037 | [Arcade Code Review](archive/037-arcade-code-review.md) (036's Arcade, before switching over) | 2026-10-05 |
| 039 | [Link Previews for Each Entry](archive/039-entry-link-previews.md) (the Arcade moved to `arcade/`, and the site's root redirects there; each entry has its own address, a copy of the Arcade's page with the entry's title and link preview, generated from the catalogue; the page writes the address as the entry plays) | 2026-10-18 |
| 041 | [Docs: Questions the Arcade Raised](archive/041-docs-from-the-arcade.md) (Reading Layout Back, Reduced Motion and The URL and the Model in the guide, and the hand-over in Open-Ended Phases) | 2026-10-18 |
| 042 | [Proposal: visual snapshot tests for views](archive/042-visual-snapshot-tests.md) (published to npm as `v-snap`: Vitest projects that draw Pixi, three.js, canvas and HTML views, and compare each image with a reference committed beside its test, the same on Windows, Linux and macOS with no Docker; every view and whole entry of the website is tested with it. Loose ends: the logo, a trial on a real project and the docs reviews, in `notes/tmp-vsnap-checklist.md`) | 2026-10-14 |
| 043 | [Arcade: Fixes From the Playtest Review](archive/043-arcade-review-fixes.md) (the search list unfolds with a CSS transition in place of the card wall's layout read in a refresh step; one open panel in the model; history steps for panels, safe against a panel opening as the page steps back; the nav magnifier in a view of its own) | 2026-10-06 |
| 044 | [Tick API: One Copy, or a Loud Failure](archive/044-one-copy-or-a-loud-failure.md) (a second copy of `@mvtjs/utils`, or of a renderer, throws as it loads, saying how to keep one; the sharing between copies, `PROTOCOL` and its fields removed) | 2026-10-18 |
| 045 | [Proposal: a virtual sound chip, and sound for the Arcade](archive/045-sound-chip.md) (the Audio80, an eight-voice mono chip in `@mvtjs/chiptune`, played by audio views that poll with `watch`, with sound for all nine games and the Arcade. Loose ends are in 048) | 2026-10-09 |
| 046 | [Proposal: highscores for the Arcade](archive/046-arcade-highscores.md) (one global table of ten for each game with a score, kept by a Cloudflare Worker with one Durable Object, in `packages/sites/arcade/highscores-worker/` (now `packages/sites/site-kit/highscores-worker/`), sharing its rules with the page in `src/highscores/`; three-letter initials entered cabinet-style in the pixel font; games report `scoring` from their sessions; a Highscores tab in the pause menu. Loose ends are task 049) | 2026-10-15 |
| 047 | [Pixel Art as Multiline Strings](archive/047-pixel-art-as-multiline-strings.md) (each texture script's pictures read by `parsePixelArt`) | 2026-10-18 |
| 051 | [Proposal: the Audio90, and entries that choose their sound chip](archive/051-audio90-chip.md) (a second chip in `@mvtjs/chiptune`: sixteen stereo voices of FM, analog or samples bounced from its own engines, with a reverb, a stereo echo, a chorus and a pump; each entry's starter names its chip; the Tune Tracker plays fifteen original tunes of the 1990s; Neon Monsoon rescored; shared pixel glyphs for the older entries; the cards' long text after the first paint. Loose ends are task 065) | 2026-10-17 |
| 052 | [Proposal: a playground that works like a small IDE](archive/052-playground-ide.md) (the playground became a package of its own, `packages/sites/playground/`, and the website became the Arcade: a project of real TypeScript files with real imports from a fixed list of libraries, intellisense from TypeScript in a worker, each run a fresh sandboxed iframe of ES modules, projects kept in IndexedDB, share links, Export as a Vite project, a file tree with kept barrels, themes, Help, and a Performance tab on `@mvtjs/html`'s new `PerfmonView`. Loose ends are tasks 057 to 064) | 2026-10-17 |
| 053 | [Models Name What the Player Means, Not the Controls](archive/053-models-name-intent-not-input.md) (every game's input record folded into its model: a held control is state named for what it does, a one-off command an action taken at the next update; Fenceline's swipes and taps became `steer` and `stop`; the host's keyboard reports only changes; `OverlayView` reports a press; `@mvtjs/no-control-names` for model files) | 2026-10-18 |
| 055 | [Rename `@mvtjs/audio` to `@mvtjs/chiptune`, and Publish It](archive/055-chiptune-package.md) (the package renamed and published, 0.3.0 by hand then 0.4.0 with the other four; each worklet inlined as a Blob URL in the published build; exported playground projects play sound; the chips stopped using `Math.pow`, whose last digit differs between Linux and Windows) | 2026-10-18 |
| 056 | [A Perfmon Throughout the Arcade, and a New Nav](archive/056-floating-perfmon-in-the-arcade.md) (the Arcade drives one performance meter from its own loop, shown in a floating `PerfmonView` over the card wall or any entry, with the GPU timed only while it is open; Boids and Falling Sand dropped their own panels; `@mvtjs/pixi`'s `createPerformanceMetrics` removed; the nav and the runner's bar touched up, and carried to the docs and the playground) | 2026-10-18 |
| 061 | [Playground: Embeds for the Docs](archive/061-playground-embeds-for-the-docs.md) (folded into 075 section 9, not done: an embed page on the playground's runtime, for examples that run inline in the docs) | 2026-10-29 |
| 064 | [HTML JSX: A Fixed `value` on a `<select>` Is Lost](archive/064-html-jsx-select-fixed-value.md) (kept until its option is added) | 2026-10-18 |
| 066 | [The Arcade's Way Into an Entry, Timed by the Model](archive/066-arcade-way-in-timed-by-the-model.md) (the Arcade's model times the way in, in phases `'launching'` and `'revealing'`, with durations shared in `data/way-in.ts`; `EntryTransitionViewModel` draws from them, and keeps its own clock for the way out; a link straight to an entry no longer shows a small picture in the corner) | 2026-10-18 |
| 067 | [Better Link Previews](archive/067-better-link-previews.md) (a 1200x630 share image for each entry, made by `generate-thumbnails`, and one of the card wall for the rest of the site; `og:image` with its size and alt, and `twitter:card`, on every page of the Arcade, the docs and the playground; `check:link-previews` after each build; the test site on Surge removed) | 2026-10-18 |
| 068 | [Proposal: music on the sound card's clock](archive/068-music-on-the-sound-cards-clock.md) (each chip has a sequencer in its worklet, which plays songs on the sound card's clock, gated by the ticks, so a late frame no longer stalls the music and pausing still pauses it; `MusicPlayer` lost `update`, and its `row` and `beat` are what is heard; a headless chip runs the same sequencer, so the audio views' tests stay exact; the Perfmon's "Chip stalls". A phone check of the full build moved to 074) | 2026-10-27 |
| 070 | [Proposal: the principles behind MVT](archive/070-principles-docs.md) (a Principles group in the Architecture docs: an overview and one page per principle, SoC, SSOT, CQS, DIP, CRP, DbC, MISU and DfT, each with its origin, what it means in MVT, its costs, examples, a checklist and the rules it underpins; linked from the rules, glossary, heritage, code review skill and `AGENTS.md`; a broken precondition throws. Code brought in line by tasks 071 to 073) | 2026-10-21 |
| 074 | [Proposal: audio90, a standalone sound package](archive/074-audio90-standalone-package.md) (`@mvtjs/chiptune` published as `audio90` 0.8.0, versioned on its own like v-snap and easy to move to a repository of its own: one clock, the sound card's, with chips paused by their host; sounds in place of instruments and sound effects; the chip as one object that plays songs itself, with no music player; a chip each for music and sound effects; repeat, pitch, fades, `stereoWidth`, `onRow` and `onEnded`; songs started part way and `positionMs`; song text; neutral docs, with the MVT material on the Sound and Music page; its own tests, reference sounds and CONTRIBUTING. The Studio moved to 077, and the gaps to task 076) | 2026-10-29 |
| 075 | [Proposal: the docs as a book](archive/075-docs-as-a-book.md) (the docs rewritten as one book, *Building Web Games with MVT*: each idea taught once, in reading order, in one voice; seven parts of numbered chapters, with the eight principles as Part VII, a conclusion, and appendices A to H; examples written for their passages that run in the page from the playground's embed, with stills in print; a PDF typeset with Paged.js on each deploy. Its follow-ups are in task 090) | 2026-11-01 |
| 078 | [Proposal: `watch` without polling](archive/078-watch-without-polling.md) (superseded by task 079, before it was built) | 2026-10-25 |
| 079 | [`watch`, Reactions and Computed Values](archive/079-watch-reactions-and-computed-values/task.md) (`watch` rebuilt, with `createReaction` and `createComputed` beside it, in `packages/libraries/utils/src/watch-api/`; `memoiseLast` removed and `createSequenceReaction` renamed `createSequenceTracker`; every call site migrated, with reactions named for their effect and trigger; four lint rules; a record watch as fast as before; the docs rewritten, with a new Computed Values page; changesets for a breaking release) | 2026-10-30 |
| 081 | [Task: Sudoku Digger, a demo of making Sudoku puzzles](archive/081-sudoku-digger-demo.md) (a demo that makes Sudoku puzzles at five levels and shows each step, after a paper from the 2008 MCM contest: seed, fill, dig and shuffle, then a grader that solves by logic. Puzzles that come out easier than asked are tried out of sight until one matches. Now in the demos site; its generator is `@mvtjs/puzzles/sudoku-generator`. Playtested) | 2026-11-27 |
| 082 | [Task: Sudoku, a game of daily puzzles with doodled notes](archive/082-sudoku-daily-game.md) (a Sudoku for every day at each level, the same for everyone with no server, from 1 January 2026; pencil marks and group notes across cells, kept in the browser. Its tutorial became 088's walkthrough. Playtested) | 2026-11-27 |
| 084 | [Proposal: three sites, and themes for them](archive/084-three-sites-and-themes.md) (the Arcade split into `packages/sites/arcade/` (its games), `demos/` and `puzzles/`, sharing `packages/sites/site-kit/`; one flat list of tags; one dev server for everything; three themes, Arcade, Dark and Light, one setting for every site, with each site's own as the default. Follow-ons in task 086) | 2026-11-01 |
| 087 | [Proposal: a wall maze puzzle for the puzzles site](archive/087-wall-maze-puzzle.md) (Minotaur, a maze to build each day, from wall-length clues: the genre known as Build a Maze or Labyrinth; playtested) | 2026-11-01 |
| 088 | [Task: one way in for every puzzle](archive/088-puzzle-way-in.md) (a How to play card for every puzzle, shown the first time, with a walkthrough from Show me acted out by an arrow on a practice puzzle, and each game's text written once in `start/how-to-play.ts`; shared in the puzzles' `src/shared/`, with a press and hold to fill a cell. Playtested) | 2026-11-27 |
| 089 | [Proposal: API cheat sheets](archive/089-api-cheat-sheets.md) (short guides to the APIs a project can use, arranged by task, chosen and written by hand, with signatures and summaries generated from the libraries' declarations, and a test that fails on a stale name or an export on no sheet; shown over the run in the playground, as a drawer in the book's embeds that opens on what the example imports, and as the book's Appendix G, its groups numbered and found by the docs' search. Its follow-ups are in task 017) | 2026-11-01 |
| 091 | [Task: the Perfmon's frames missed while the main thread is free](archive/091-perfmon-missed-frames.md) (a Missed row, `missedShare`: the share of the frames the display could have shown that went missing while the main thread had time to spare, for every renderer. It shows slow drawing that happens off the main thread, which the CPU figure can't see. Released for `@mvtjs/utils` and `@mvtjs/html`. The checks in real browsers are in task 017) | 2026-11-27 |
| 092 | [Decision: update and refresh, or update alone?](archive/092-update-and-refresh-or-update-alone/decision.md) (decided: keep both, by a thin margin. A spike ran `refresh` as the last step of `update` across the whole test suite and nothing real broke. The rules that matter most apply in either design, and update-only's mistakes are quiet where today's are loud. Records the rules it led to, `update(0)`, relays outside the frame, the gotchas, Unity's `LateUpdate`, update-only as a house style, a second evaluation, and what would reopen it, with the spike's patch and scripts. The book's version is in Chapter 34, with Unity's `LateUpdate` in Appendix H. Enforcement is in task 093, and naming in 072) | 2026-11-07 |
| 094 | [Proposal: drags on a grid, handled one way](archive/094-drags-on-a-grid.md) (three layers: `listenToPointer` follows one pointer over a Pixi container, `createGridGesturesViewModel` turns its path in cells into taps and steps between neighbouring cells or corners, and each entry says what a step means, with game rules wired in its top-level view. Minotaur, Sudoku and Kwazy Cactii use it, and the site kit's drag and swipe views; playtested on a phone) | 2026-11-07 |
| 095 | [Proposal: input across the sites](archive/095-input-across-the-sites.md) (094's layers extended to all input: the arcade controls read a table of keys through `listenToKeys`, fixing five keyboard bugs, and each game wires them in its top-level view, with `arcadeControls` on its starter in place of `inputConfig`. How to play names the controls. Buttons fire on a tap. Shared helpers: `listenToPress`, `listenToPointer` everywhere it fits, `createPressGesturesViewModel`, `listenToPanZoom`, `listenToElementPointer` and `listenToPressOutside`. Loose ends in 098, the three.js picker in 097) | 2026-11-13 |
| 096 | [Proposal: a colour gradient swap puzzle on a Penrose tiling](archive/096-colour-gradient-swap-puzzle.md) (built and committed (94229408, 2026-11-13), and finished. Rosette (first called Glass Smith), a daily puzzle for the puzzles site: a smooth gradient over a rhombus tiling (5, 7, 8, 10 or 12-fold, de Bruijn's multigrid) cut to a window frame, one of 12 convex outlines taken in turn, a frame a day. The pieces the frame cuts deeply are locked; pieces it only trims, and every piece inside, are jumbled and swapped back, each only with a piece of its own shape, and a piece put in its place next to the locked ones locks too, so the window is mended from the frame in. Subtlety is the closest pair of colours in OKLab: a hue axis and a lightness axis, in OKLCH, scaled to each level's target. Four-corner gradients ruled out (grey middles). A colour vision setting is proposed, not built. Playtested five times: shapes kept, swap flights, the frame, a ripple and sunrise celebration with god rays, trimmed pieces freed. The colour vision setting and more gradient layouts and moods were set aside) | 2026-11-27 |
| 099 | [Proposal: a star placement puzzle](archive/099-star-placement-puzzle.md) (built as **Stars**, out of beta after a review. Genre known as Star Battle (no `inspiredBy`). Two stars a line at every level: Easy and Medium 8x8, Hard 9x9, Expert 10x10. A tap cycles a cross (no star) and a gold star, and a drag rings a group ("a star is in one of these"), joined side to side and never overlapping. Its generator was replaced by 101's. The daily puzzles are pinned by a test, so a change to the maker can't silently drop players' progress) | 2026-11-20 |
| 100 | [Proposal: v-snap: canvas text in a project's own fonts](archive/100-vsnap-project-fonts.md) (a project registers its own font files for named families with `vsnap({ fonts })`, as paths, checked in Node as the config loads, and loaded by the page before any project code draws (not in `vsnap.config.ts`, nor per test file, since canvas files share a page). v-snap lays them out with `fontkit` and fills glyphs as paths, as it does its own fonts, so images still match everywhere. Faces picked by CSS's rule, italic faces or axes before a slant, no fake bold, fallback run by run through the list, then v-snap's own font, then the hex box. Registered families need no generic family, and `sans-serif` and `monospace` may be registered. Projects with no `fonts` draw byte-identical images; the whole repo's visual tests changed no reference) | 2026-11-17 |
| 101 | [Proposal: Stars without guessing](archive/101-stars-without-guessing.md) (direct techniques only: neighbours, full lines, bands, pressure and 2x2 boxes, never supposing, and no hints. Every puzzle is fair by construction: regions grown round a layout, givens (stars and crosses, printed in ink) added until the techniques finish it, unneeded ones dropped, the fewest of three tries kept. Reshaping and solution counting are gone. Wherever the rules stall, at least two cells must be findable, or a given is printed. In Node, 2 ms (Easy) to 74 ms (Expert, 10x10) a puzzle, with 0.2 to 6 givens on average. Playtested. Phone timings weren't recorded. On leaving beta, givens are removed in repeated passes, so every given left is needed; 26 of 2026's puzzles lost a given) | 2026-11-20 |
| 102 | [Proposal: Minotaur without guessing](archive/102-minotaur-without-guessing.md) (steps 1 and 2 built 2026-11-20 and playtested: every level uses the rules alone, and the maker draws again until they finish; Easy and Medium mazes unchanged. Hard hides 3 clues and Expert 4, shown as a violet `?` (hiding all the rules allow, 6 to 8 at Expert, was too hard by hand). Before: every Hard and Expert maze needed a guess by design (the maker keeps only mazes needing tries, which 101 ruled guessing; the rules settle about a third of the edges, then stall); every level to use the rules alone. Givens would work (one edge, rarely two) but aren't needed: the rules finish about 90% of random mazes up to 9x9 and 75% at 11x11, so the maker draws again. Bridges and two-edge cuts tried, not worth it. Hard and Expert stay harder by hiding the clues the rules can do without, shown as `?` (about a third; 70% more passes). Easy and Medium unchanged. Playtested in full, Expert with 4 hidden clues included) | 2026-11-27 |
| 104 | [Proposal: two line-count puzzles, a fleet and a track](archive/104-fleet-and-track-puzzles.md) (built, reviewed and committed 2026-11-20 (406c660a to 8a7719d4), and finished. Two genres with a number beside every row and column, both fine to make our own. The fleet puzzle (Battleship Solitaire, Jaime Poniachik, Argentina, 1982), dressed as boats moored in a harbour, **Boats** (first Moorings). The track puzzle (Train Tracks, origin uncertain, perhaps Philipp Hübner), dressed as a river from a spring to the sea, **River** (first Meander). Both out of beta, as Boats and River. Avoid "Battleship(s)" (Hasbro's mark) and "Bimaru". Both are fair by construction, as in 101 and 102. The maker lays out the answer, adds givens until a direct-technique solver finishes, then drops the ones it can do without. Moorings first) | 2026-11-27 |
| 106 | [Task: showcases as a site mode, each with an easter egg](archive/106-showcases-as-a-site-mode.md) (a site browses its entries on its card wall or in its showcase, chosen in the nav's Browse menu and kept between visits for all three sites. The showcase fills the area under the nav, at the site's address, and fades up over the card wall; its own address opens it. Each hides an easter egg: the Arcade Hall's meadow, the Gallery's lantern room, and The Daily Fold's noughts and crosses. In vnext since 2026-11-23, with the changes its last section lists) | 2026-11-23 |
| 108 | [Task: showcases out of the entries](archive/108-showcases-out-of-the-entries.md) (each site's showcase lives in its `src/showcase/`, named by `SiteConfig.showcase`, not the catalogue, and built from `@mvtjs/site-kit/showcase`. The page runs it in a host of its own, and an entry it launches is an ordinary launch on a clear canvas, so nested entries are gone. In vnext since 2026-11-23, with the changes its last section lists) | 2026-11-23 |
| 107 | [Proposal: a complete JSX for PixiJS 3D](archive/107-complete-pixi-3d-jsx.md) (Views list the geometry, materials and textures they make in `owns`, which the JSX base supports for every renderer. A lint rule and a leak check in each 3D entry's visual tests catch a resource that isn't listed. The base has creation attributes, and the element table is complete, with `sprite3d`, `batchedMesh`, `model`, twelve pointer events and `hitVolume`. Time comes from `deltaMs` alone, through `<model clip clipTimeMs>` and a seeded `ParticlesView`, and a lint rule reports `autoUpdate`. `Scene3DView` is complete, `ScreenView` draws from its first frame through a renderer system, and `ScreenAnchorView` places 2D over a point in 3D. The package matches the other renderer packages, and is ready to build but private. Docs, cheat sheets, a playground starter and PixiJS 3D's own skill cover it. Publishing is 111, and the HTML bridge is 112. Brought into vnext 2026-11-22, with the 3D entries still to come) | 2026-11-22 |
| 113 | [Proposal: v-snap on machines that draw differently](archive/113-v-snap-on-machines-that-draw-differently.md) (a spike found that SwiftShader compiles shaders with Subzero on x64 and LLVM on arm64, and LLVM fuses its multiply-adds, but each shader compiler draws exactly alike on every machine. v-snap reads the shader compiler from the WebGL renderer string and records it in each reference. Within one shader compiler it compares within the tolerance; across them, each pixel may also change by up to its largest step to a neighbour, the most one antialiasing sample crossing an edge can change it. The stopgap is gone, `-u` keeps a passing reference from the other shader compiler, and `shaderCompiler` is exported for skipping as a last resort. A second reference for each shader compiler was set aside. Loose ends in 114) | 2026-11-24 |

## Elsewhere

- **002** and **006** turned out to describe shipped code. 002 lives next
  to it, [packages/libraries/pixi/src/design-notes.md](../packages/libraries/pixi/src/design-notes.md); 006,
  the `<List>` patterns guide, is now the docs page
  [Presenting Collections](../packages/sites/docs/building-with-mvt/presenting-the-world/collections.md).
- **009** was never used.
- Tasks 014-016 were numbered 001-003 before 2026-09-26.
- [Can pull match push?](../packages/sites/docs/articles/can-pull-match-push.md), a write-up
  of the `<List>` design for a general audience, is in `packages/sites/docs/articles/`. It is
  a draft, excluded from the docs build until it is published.
