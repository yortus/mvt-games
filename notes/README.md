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
**074**.

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
052. The paths above are the ones in use after both.

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
| 068 | [Music on the sound card's clock](./proposals/068-music-on-the-sound-cards-clock.md) | Proposed. Moves a song's place from the page to the audio thread, beside the synthesiser, so a late frame can no longer stall the music. The ticks still gate it, so pausing still pauses it, and a headless chip runs the same sequencer, so the audio views' tests stay exact. Follows the fixed 100 ms lead and stalls that hold, unstaged in main on 2026-10-20 |
| 069 | [A line length of 120, and single-line imports](./proposals/069-line-length-and-single-line-imports.md) | Proposed. Four stages: write down 120, enforce it with `@stylistic/max-len` (1,045 lines to fix by hand, a package at a time), add `@mvtjs/single-line-imports`, which writes each import and re-export on one line by a cascade of merge, split values from types, then split by length, and turn it on with `lint:fix` (about 180 files) |
**How they relate.** All of them can be read on their own. 022 is the
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
shipping game. 035 adds a demo that follows the same rules, and would be an
entry in the Arcade that 036, now archived, built. 042, now archived, reused 036's
thumbnail code to give every entry a visual test, and made true what 015's
testing docs already describe. 045, now archived, built the sound chip that
035's music can play on, which 035's section 8 deferred. It gave `watch` its
`increased` and `decreased`, which 008's builder may want too.
046, now archived, added to what a session gives its host, as 045 added
to what the host gives a session, and built on 036's Arcade.
051, now archived, added a second chip beside 045's, and changed what 045
made the host give every session into a chip each entry chooses. Its Sound
Test demo was 048's idea, and it rescored 034's game.
052, now archived, moved the playground out of the package that 036 made,
added it to 011's workspace, and renamed what was left after 036's Arcade.
A project can play the chip that 045 built, or the one 051 chooses. Its
loose ends are tasks 057 to 064. 068 would move the music player that
045 built, and 051 extended, onto the audio thread. 070, now archived,
touched only the docs, and its tasks 071 to 073 bring the code in line with
its pages.

## Tasks

### Active

| # | Task | Priority | Created |
| --- | --- | --- | --- |

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
| 061 | [Playground: Embeds for the Docs](tasks/backlog/061-playground-embeds-for-the-docs.md) | low | 2026-10-17 |
| 062 | [Check the Playground on Real Phones and in Safari](tasks/backlog/062-playground-on-phones-and-safari.md) | medium | 2026-10-17 |
| 063 | [Playground: Shortcuts While the Preview Has the Keyboard](tasks/backlog/063-playground-shortcuts-while-the-preview-has-focus.md) | low | 2026-10-17 |
| 065 | [Audio90: Follow-Ons](tasks/backlog/065-audio90-follow-ons.md) | low | 2026-10-17 |
| 071 | [Throw on Broken Preconditions](tasks/backlog/071-throw-on-broken-preconditions.md) | medium | 2026-10-06 |
| 072 | [Update and Refresh Method Names](tasks/backlog/072-update-and-refresh-method-names.md) | low | 2026-10-15 |
| 073 | [Models Take Their Random Source](tasks/backlog/073-models-take-their-random-source.md) | medium | 2026-10-15 |

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
| 017a | [Miscellaneous Loose Ends: Finished](archive/017a-misc-loose-ends-done.md) (the finished items of 017, split out of it) | 2026-10-18 |
| 018 | [Proposal: one view convention](archive/018-one-view-convention.md) | 2026-09-27 |
| 020 | [Proposal: falling sand as an implementation lab](archive/020-falling-sand-variants.md) | 2026-09-27 |
| 021 | [JSX and Teardown Quick Wins](archive/021-jsx-and-teardown-quick-wins.md) | 2026-09-28 |
| 024 | [Merge 022's Changes in Reviewed Steps](archive/024-merge-022-in-steps.md) | 2026-09-30 |
| 025 | [Keep the JSX Precompiler, or Ship Two Builds?](archive/025-precompiler-or-two-builds.md) (decided: neither; one eval-free runtime) | 2026-10-01 |
| 026 | [Demos Screen for Every Renderer](archive/026-demos-screen-for-every-renderer.md) (absorbed by 036's Arcade) | 2026-10-05 |
| 027 | [Proposal: aligning the scene methods with MVT's `update` and `refresh`](archive/027-mvt-method-names.md) (decided: no methods on nodes; the tick API, `setTickMethods` / `tickScene`) | 2026-10-02 |
| 028 | [Move to the Tick API (`tickScene` / `setTickMethods`)](archive/028-tick-api-migration.md) | 2026-10-02 |
| 029 | [Rename `onTick` to `setTickMethods`](archive/029-rename-ontick-to-settickmethods.md) (returns `void`) | 2026-10-02 |
| 030 | [A Self-Describing Perfmon Panel](archive/030-self-describing-perfmon.md) | 2026-10-02 |
| 031 | [Proposal: the tick API in MVT's own words](archive/031-tick-api-in-mvt-terms.md) (`updateView` / `refreshView` and `setUpdate` / `setRefresh`, one set for every renderer; `tickCounter`; `PerformanceMetrics`; "scene pass" retired) | 2026-10-03 |
| 033 | [Fruit Machine Demo](archive/033-fruit-machine-demo/task.md) (one model, four views: Pixi, three.js, an HTML panel and a terminal) | 2026-10-03 |
| 036 | [Proposal: the website, and one Arcade for every entry](archive/036-website-arcade.md) (`site/` became `packages/sites/arcade/`, with `docs/`, `benchmarks/` and `checks/` beside it; the cabinet and the demos gallery became one Arcade, the home page, in HTML JSX: a search with tag tokens, a card wall in columns, committed thumbnails, a burn and power-on transition, and attract mode; every game and demo an entry in `src/entries/`, Pixi or `element`, hosted in one loop; a size budget on the home page. Absorbed task 026; loose ends are tasks 038-041) | 2026-10-05 |
| 037 | [Arcade Code Review](archive/037-arcade-code-review.md) (036's Arcade, before switching over) | 2026-10-05 |
| 039 | [Link Previews for Each Entry](archive/039-entry-link-previews.md) (the Arcade moved to `arcade/`, and the site's root redirects there; each entry has its own address, a copy of the Arcade's page with the entry's title and link preview, generated from the catalogue; the page writes the address as the entry plays) | 2026-10-18 |
| 041 | [Docs: Questions the Arcade Raised](archive/041-docs-from-the-arcade.md) (Reading Layout Back, Reduced Motion and The URL and the Model in the guide, and the hand-over in Open-Ended Phases) | 2026-10-18 |
| 042 | [Proposal: visual snapshot tests for views](archive/042-visual-snapshot-tests.md) (published to npm as `v-snap`: Vitest projects that draw Pixi, three.js, canvas and HTML views, and compare each image with a reference committed beside its test, the same on Windows, Linux and macOS with no Docker; every view and whole entry of the website is tested with it. Loose ends: the logo, a trial on a real project and the docs reviews, in `notes/tmp-vsnap-checklist.md`) | 2026-10-14 |
| 043 | [Arcade: Fixes From the Playtest Review](archive/043-arcade-review-fixes.md) (the search list unfolds with a CSS transition in place of the wall's layout read in a refresh step; one open panel in the model; history steps for panels, safe against a panel opening as the page steps back; the nav magnifier in a view of its own) | 2026-10-06 |
| 044 | [Tick API: One Copy, or a Loud Failure](archive/044-one-copy-or-a-loud-failure.md) (a second copy of `@mvtjs/utils`, or of a renderer, throws as it loads, saying how to keep one; the sharing between copies, `PROTOCOL` and its fields removed) | 2026-10-18 |
| 045 | [Proposal: a virtual sound chip, and sound for the Arcade](archive/045-sound-chip.md) (the Audio80, an eight-voice mono chip in `@mvtjs/chiptune`, played by audio views that poll with `watch`, with sound for all nine games and the Arcade. Loose ends are in 048) | 2026-10-09 |
| 046 | [Proposal: highscores for the Arcade](archive/046-arcade-highscores.md) (one global table of ten for each game with a score, kept by a Cloudflare Worker with one Durable Object, in `packages/sites/arcade/highscores-worker/`, sharing its rules with the page in `src/highscores/`; three-letter initials entered cabinet-style in the pixel font; games report `scoring` from their sessions; a Highscores tab in the pause menu. Loose ends are task 049) | 2026-10-15 |
| 047 | [Pixel Art as Multiline Strings](archive/047-pixel-art-as-multiline-strings.md) (each texture script's pictures read by `parsePixelArt`) | 2026-10-18 |
| 051 | [Proposal: the Audio90, and entries that choose their sound chip](archive/051-audio90-chip.md) (a second chip in `@mvtjs/chiptune`: sixteen stereo voices of FM, analog or samples bounced from its own engines, with a reverb, a stereo echo, a chorus and a pump; each entry's starter names its chip; the Tune Tracker plays fifteen original tunes of the 1990s; Neon Monsoon rescored; shared pixel glyphs for the older entries; the cards' long text after the first paint. Loose ends are task 065) | 2026-10-17 |
| 052 | [Proposal: a playground that works like a small IDE](archive/052-playground-ide.md) (the playground became a package of its own, `packages/sites/playground/`, and the website became the Arcade: a project of real TypeScript files with real imports from a fixed list of libraries, intellisense from TypeScript in a worker, each run a fresh sandboxed iframe of ES modules, projects kept in IndexedDB, share links, Export as a Vite project, a file tree with kept barrels, themes, Help, and a Performance tab on `@mvtjs/html`'s new `PerfmonView`. Loose ends are tasks 057 to 064) | 2026-10-17 |
| 053 | [Models Name What the Player Means, Not the Controls](archive/053-models-name-intent-not-input.md) (every game's input record folded into its model: a held control is state named for what it does, a one-off command an action taken at the next update; Fenceline's swipes and taps became `steer` and `stop`; the host's keyboard reports only changes; `OverlayView` reports a press; `@mvtjs/no-control-names` for model files) | 2026-10-18 |
| 055 | [Rename `@mvtjs/audio` to `@mvtjs/chiptune`, and Publish It](archive/055-chiptune-package.md) (the package renamed and published, 0.3.0 by hand then 0.4.0 with the other four; each worklet inlined as a Blob URL in the published build; exported playground projects play sound; the chips stopped using `Math.pow`, whose last digit differs between Linux and Windows) | 2026-10-18 |
| 056 | [A Perfmon Throughout the Arcade, and a New Nav](archive/056-floating-perfmon-in-the-arcade.md) (the Arcade drives one performance meter from its own loop, shown in a floating `PerfmonView` over the wall or any entry, with the GPU timed only while it is open; Boids and Falling Sand dropped their own panels; `@mvtjs/pixi`'s `createPerformanceMetrics` removed; the nav and the runner's bar touched up, and carried to the docs and the playground) | 2026-10-18 |
| 064 | [HTML JSX: A Fixed `value` on a `<select>` Is Lost](archive/064-html-jsx-select-fixed-value.md) (kept until its option is added) | 2026-10-18 |
| 066 | [The Arcade's Way Into an Entry, Timed by the Model](archive/066-arcade-way-in-timed-by-the-model.md) (the Arcade's model times the way in, in phases `'launching'` and `'revealing'`, with durations shared in `data/way-in.ts`; `EntryTransitionViewModel` draws from them, and keeps its own clock for the way out; a link straight to an entry no longer shows a small picture in the corner) | 2026-10-18 |
| 067 | [Better Link Previews](archive/067-better-link-previews.md) (a 1200x630 share image for each entry, made by `generate-thumbnails`, and one of the card wall for the rest of the site; `og:image` with its size and alt, and `twitter:card`, on every page of the Arcade, the docs and the playground; `check:link-previews` after each build; the test site on Surge removed) | 2026-10-18 |
| 070 | [Proposal: the principles behind MVT](archive/070-principles-docs.md) (a Principles group in the Architecture docs: an overview and one page per principle, SoC, SSOT, CQS, DIP, CRP, DbC, MISU and DfT, each with its origin, what it means in MVT, its costs, examples, a checklist and the rules it underpins; linked from the rules, glossary, heritage, code review skill and `AGENTS.md`; a broken precondition throws. Code brought in line by tasks 071 to 073) | 2026-10-21 |

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
