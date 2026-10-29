# Miscellaneous Loose Ends

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-26 |
| Updated  | 2026-10-18 |

## Description

Outstanding items left over from finished work. Each one came from a document
that is now archived, or from no document at all. Items that belong to an open
proposal are tracked in that proposal, not here.

Take an item out into its own task or proposal when it grows beyond a quick
fix. Tick it here and log where it went. Finished items move to
[017a](../../archive/017a-misc-loose-ends-done.md), in the archive, so this list holds only
what is still open.

Settled questions that should not be reopened without new information are in
[004](../../archive/004-list-proposal.md) section 11 (items 5-7) and section 5.4
("Evolution").

### Fix

- **The games allocate on the hot path.** Dojo Duel about 800 bytes per
  frame, unexplored, measured before its sprites were replaced with fighters
  drawn in code. Fixed so far, 2026-09-27:
  - Fuel Run, 2.7 KB to about 270 bytes, by 018's pilot migration; the likely
    causes were graphics redrawn every frame (each explosion, and the fuel
    bar while fuel drains), now scaled or resized instead.
  - Crumb Chase, 2.1 KB to about 235 bytes. Measured first: 1.9 KB of it was
    the model, not the views. The mouse and the four cats each started a GSAP
    tween, and a `set`, for every one-tile step. Their moves are now a
    `TileMove` (`packages/sites/arcade/src/games/crumb-chase/models/tile-move.ts`, with tests): a
    straight slide advanced by `update(deltaMs)` that allocates nothing, with
    the same semantics (linear, starting from wherever the actor is, and no
    time carried from one move to the next). The model now allocates nothing
    per frame.

  To split a game's allocation between its update and its refresh, the
  `games-and-demos` case file's `frame` can be made to skip one of the two;
  that is how Crumb Chase's was found.

- **Multi-line imports and exports, and no line length.** The preferred form
  (2026-09-30) is single-line statements from one module, as few as stay
  within the line length, splitting values and types into an `export` and an
  `export type` line where that is enough:

  ```ts
  export { addReads, countTick, tickCounter } from '@mvtjs/utils';
  export type { RefreshMethod, TickCounts, UpdateMethod } from '@mvtjs/utils';
  ```

  The files 022 changed were fixed by hand. Lint can enforce the rest:
  `@stylistic/object-curly-newline` with `{ ExportDeclaration: 'never',
  ImportDeclaration: 'never' }` bans line breaks inside the braces (its
  auto-fix joins them onto one line), and `@stylistic/max-len` at 120
  columns, the line length the code already keeps to (only 82 of about
  43,000 source lines were longer), stops the join making long lines. No
  stock rule splits values from types; that stays a style-guide convention.
  Measured 2026-09-30 over `src`, `scripts` and `benchmarks`: 13 multi-line
  exports (all in game and demo barrels), 36 multi-line imports, and 43
  lines over 120 columns (ignoring strings, template literals, regular
  expressions and URLs). Fix those, add both rules, and add the convention
  to the style guide.

  **Measured again 2026-10-18, over `packages/` (about 170,000 lines):**
  the code no longer keeps to 120. `object-curly-newline` as above reports
  372 multi-line imports and exports. Lines over each length, ignoring the
  same things: 980 over 120 (in 389 files, 103 of them in
  `utils/src/jsx/refresh-copies.ts`), 237 over 140 (152 files), 45 over 160
  (31 files), 11 over 180, and 1 over 200. So the length to enforce needs
  deciding first: 120 means rewrapping about a thousand lines, and 160
  about fifty. Joining the multi-line imports waits on it, since a joined
  import must fit too.

- **`<List>` inside a list element wraps its items.** In a JSX body,
  `<ol><List items={...}>{(item) => <li ... />}</List></ol>` builds the items
  into an `mvt-group` (`display: contents`), so the markup is
  `ol > mvt-group > li`. It looks right, but it isn't valid list markup, and
  assistive technology may not read it as a list. `<List>`'s `container`
  option avoids the wrapper, but needs the `<ol>` built first, outside the
  JSX expression it belongs in. Options: `<List>` adopting its parent as its
  container when it is the parent's only child (a hook when the JSX target
  appends it), or an option that builds the container itself
  (`<List as="ol">`). It affects every renderer's `<List>`, so it is a design
  question for `@mvtjs/utils/jsx`, not a fix in the HTML target alone. Found
  building the fruit machine's wins list (033), which still has the wrapper:
  `packages/sites/arcade/src/demos/fruit-machine/views/panel/wins-list-view.tsx`.

- **Pixi's pooled `BatchableGraphics` keep `roundPixels`.** Found by 042's
  spike (2026-10-07), in Pixi 8.21: `BatchableGraphics.reset()`
  (`scene/graphics/shared/BatchableGraphics.mjs`) clears its renderable and
  topology but not `roundPixels`, so a batch returned to `BigPool` by a
  rounded graphic (a pixel-art entry, or `roundPixels` on the renderer)
  rounds the next graphics context built from the pool. A smooth view's
  curves then snap to whole pixels (one MSAA sample at rounded corners),
  depending on what was drawn before it. The Arcade can hit it when a
  smooth entry follows a pixel-art one in the same page. To do: report it
  to Pixi with a minimal repro (draw a rounded `Graphics`, destroy it, then
  draw a large smooth `roundRect` and compare with a fresh page), and
  decide whether the site patches `reset` meanwhile as 042's harness does
  (`packages/sites/arcade/visual-spike/setup.ts` on the `visual-tests` branch).

### Decide

- **The draft articles still use the old tick API.** `who-calls-update.md`
  and `why-not-just-update.md`, on the `draft-articles` branch, were written
  against `tickScene` and `setTickMethods`, and use "scene pass" and
  "memoised walk". Before either is published, move them to `updateView`,
  `refreshView`, `setUpdate` and `setRefresh`, and to 031's vocabulary
  ([031](../../archive/031-tick-api-in-mvt-terms.md) section 5). Whether
  `who-calls-update.md`, "A Look at the Tick API", should now tell the story
  of the API's names too is the writer's call.

- **Dev checks from 027 that were not built.** Task 028 added only the
  `deltaMs` check (now in `updateView`), and 031 the check that a value
  passed to `updateView` or `refreshView` is a view of an installed renderer.
  Still to decide, each argued in [027](../../archive/027-mvt-method-names.md):
  - section 7.5 (b): a stale cached method list, which would throw;
  - section 7.5 (c): an update method that no `updateView` call reaches, which
    would warn. This is the one that recovers most of what an explicit
    `update` method's type used to say (027 section 12.3);
  - section 7.6, item 2: a check of each method's result, catching a value
    that is neither `undefined` nor `SKIP_DESCENDANTS` (a second copy of the
    library, once the packages are published).

  Each needs a cost check in dev against `refresh-view`, and a decision on how
  often it runs (027 section 9, items 10 and 11).

- **Button presses shorter than a frame are missed.** The games' models see
  input by polling a pressed flag in their update, so a press and release
  that both arrive between two updates leave no trace. Real presses almost
  always last longer than a frame, and the overlay now guards its own
  (see Fix). A general fix would have each game's player input latch a
  press until the model has seen it. Worth it only if short presses turn out
  to be a problem in practice.

- **Hot path rules that cost nothing in V8.** The `hot-path-rules` suite
  found that `for...of` over an array and returning a `[col, row]` tuple cost
  nothing extra. The docs' Hot Paths page keeps both rules and says why, but
  `AGENTS.md` critical rule 5 still bans `for...of` outright. Keep, soften, or
  drop? From [010](../../archive/010-performance-docs-proposal.md) section 9,
  step 7.

- **Benchmarks in browsers, with rendering included.** Everything so far is V8
  under Node with nothing rendered. See `packages/internal/benchmarks/README.md`, "What is
  excluded", and 010 section 8, items 1-2.

- **CI benchmarking.** Timing noise on shared runners makes it hard; 010
  recommended treating the harness as an on-demand tool. 010 section 8, item
  4.

### Investigate

- **Fractional numbers boxed depending on unrelated code.** Twice, writing a
  fractional number cost a 16-byte heap allocation that a standalone copy of
  the same code did not. V8 stores whole numbers up to about a billion
  without allocating, but can box a fractional number when it stores or
  passes one, and here whether it does depends on code nearby.
  - **Boids, `rotation`.** Setting `rotation` on the boids' pooled `Graphics`
    allocated 16 bytes per boid per frame, even when the value was unchanged,
    so the cost was in the call. 200 fresh `Graphics`, parented or not, with
    the whole app loaded or not, allocated nothing. Worked around by turning
    the boids with `skew` (see `boids-view.ts`).
  - **The `memory` suite's synced scene, fractional values.** With the `jsx`
    approach, the model's own `x += step` and `y += step` writes allocate
    about 32 bytes per changed item (32 KB per frame for 1000). With
    `hand-written`, nothing. It is not the JSX runtime: it stays with the view
    refresh removed, with static-only JSX, and with no JSX at all (closures
    over each item and a plain `Container`), but goes when the `jsx` approach
    runs the hand-written view code. A tidier standalone copy of the JSX setup
    allocates nothing. Reproduce with
    [`packages/internal/benchmarks/repro/fractional-boxing.ts`](../../../packages/internal/benchmarks/repro/fractional-boxing.ts)
    (`jsx` 32 KB per frame, `hand-written` 0, one per process; run both in one
    process and both allocate). Kept out of the suite until explained, so it
    is not read as a JSX cost.
  - **Crumb Chase, after its game view became JSX (2026-09-27).** It allocates
    about 384 bytes per frame, up from 234. Its update alone allocates
    nothing, and so does its refresh alone; together they allocate about 160
    bytes more: five actors (the mouse and four cats) each writing a
    fractional `row` and `col` through `TileMove`, 16 bytes each. Replacing
    the view's `<List>` with fixed views changes nothing, so it is the JSX
    setup nearby, as in the synced scene. See 018 section 21.2.
  - **A clue from the attempt to add it to the suite.** Giving the synced
    scene a `values` option, with whole and fractional rules in two object
    literals of the same shape, made even the whole-number runs store boxed
    numbers: memory kept per container rose by about 48 bytes (three boxed
    numbers), and the "wasteful" approach's garbage from 97 to 161 KB per
    frame. Reading `step` and `offset` from an object whose fields also held
    fractions turned whole numbers fractional as far as V8 was concerned. The
    option was removed and the scene restored.
  - **Ruled out** (do not reopen without new information): hidden-class
    variety (all 200 boid `Graphics` share one map), field widening
    (`--trace-generalization` shows none for the fields involved), and, for
    the synced scene, deoptimisation (`--trace-deopt` shows none; its
    `changeItems` is optimised by TurboFan once, in both approaches, and stays
    so). The sampling heap profiler, with collected objects included,
    attributes the allocations to `refreshBoids` for boids, and to the synced
    scene's `frame`, which calls `changeItems`.
  - **Next steps.** Compare the optimised code of the allocating and the
    non-allocating versions (`--print-opt-code`, or Turbolizer with
    `--trace-turbo`), or ask on the V8 issue tracker with the synced-scene
    reproducer. If it proves to be something code can avoid, record the rule
    on the Hot Paths page.

- **Object literals with getters are slow in V8.** Found by
  [020](../../archive/020-falling-sand-variants.md) section 6.1: V8 12.4
  keeps an object literal that has a `get` accessor in dictionary mode
  (`%HasFastProperties` is false), so reads from it are hash lookups and
  calls through it are never inlined. Removing one getter made the
  falling-sand pixel view 3x cheaper. The repo's models are object literals
  with getters by convention (the style guide's `createCounterModel`, the
  model skill), which does not matter for a model read a few times a frame,
  but does for per-item models read by per-item views. Next steps: list the
  per-item models and their views; measure one sprite-per-item view with its
  model's getters replaced by plain fields; if it pays, record a rule (plain
  fields on per-item records, or accessors added with
  `Object.defineProperty`, which keeps the object fast). Possibly related to
  the boxing item above: the boids' record with getters also boxed numbers
  written to it.

- **DOM churn costs 3-6% more since the tick API's storage.** In
  `html-scene-passes`, the DOM's churn case measured 3-6% slower with the
  private fields' defaults on `Element.prototype` (027 section 11.8, variant
  C) than before; task 028 added nothing to it. Unexplained. The first suspect
  is the per-node `visit()` call in rebuilds. Profile one churn frame in
  headless Chrome before and after.

- **Two slowdowns between the 2026-09-25 and 2026-10-02 saves, not yet
  attributed.** The `scene-passes` churn case went from 91 to 127 µs while
  its naive walk went from 36 to 29 µs, and falling sand's refresh scene pass
  in `games-and-demos` from 120 to 159 µs. Between the two saves, Node went
  from 22.11 to 26.10, Pixi from 8.16 to 8.21, and task 028 moved the scene
  passes to the tick API. Task 028's scene counter is not the cause: the
  commit before it measures the same (127 and 159-164 µs) in interleaved
  runs. To attribute: run both cases on Node 22 and 26 at that commit, then
  at the commit before 028's phases 1-4.

- **An allocation budget check.** 011 dropped a lint rule against per-tick
  allocation, since lint cannot tell what runs every tick
  ([011](../../archive/011-multi-package-repo.md) section 12.8). Measuring
  catches it instead: the memory suite already counts bytes allocated per
  frame, so a check that runs each game for a long window (say 10,000
  frames) and fails past a per-game budget would catch a regression wherever
  it comes from. Open: whether it can run in CI at all (the suite needs a
  browser), or stays a local check before release.

### Experiments (from 020)

Follow-ups to [020](../../archive/020-falling-sand-variants.md), in the
falling-sand demo. Each is a new variant, measured with
`npm run bench -- falling-sand-scaling`.

- **A store that reads raw state in the simulation loop** (`unwrap`), keeping
  the store for what views read. How much of the store's 190x an experienced
  Solid developer would avoid, and what is left for the notifications.

- **A change feed in the model interface**: the ids of the grains that
  changed in the last update, used by the polled pixel view to redraw only
  those. Change-driven updates without a reactive library, on the same model.

- **A bulk-read or read-only-arrays path in `Grains`** for the pixel view:
  whether the rest of 013's 1.5-4 ns per grain is reachable, and what it
  costs the interface.

- **An arrays grid that scans cells** rather than keeping a moving list: 013's
  "chunked scan" estimate of 5-20 ns per active cell. A new algorithm, not a
  new layout.

- **An instanced-mesh grain view** from a `Float32Array`: the per-entity flat
  view 013 described, for cases a texture does not fit.

- **Optional: report pixi-solid's child reconciliation upstream.** Whenever a
  container's children change, it re-adds every child and checks each old
  one with `includes`: O(n²) per change, costly while pouring into a large
  tank (020 section 7.6).

### Parked (pick up only when the trigger happens)

- **`<List>` follow-ups**: a `range()` helper, merging the per-slot presence
  check into the item view's method, and a typed `matchOn<T>()`. Each names its
  trigger. 004 section 11, items 1, 3 and 4. Item 2, a lint rule against
  calling the item accessor while building, is no longer needed: a slot's view
  is now built the first time the slot holds an item, with that item in place
  (018 section 21.3).

- **A change-gate for idle subtrees** (`refreshWhen`). Unmeasured. Trigger: an
  idle-heavy UI appears. 010 section 8, item 5.

## Acceptance Criteria

- [ ] Games' hot-path allocations found, and fixed or recorded
- [ ] Pixi's `BatchableGraphics` pool bug reported upstream, and patched in the site or left
- [ ] Hot path rules decision made, and `AGENTS.md` matches the docs
- [ ] Browser benchmarking and CI benchmarking each decided
- [ ] Fractional-number boxing explained, and fixed or recorded as a rule
- [ ] Getter literals on per-item models measured, and fixed or recorded as a rule
- [ ] 027's remaining dev checks each built or dropped
- [ ] DOM churn cost since the tick API explained, or recorded
- [ ] Churn and falling-sand slowdowns between the September and October saves attributed
- [ ] 020's experiments each run, or dropped
- [ ] An allocation budget check built, or dropped
- [ ] Parked items each still parked, or moved into their own task
- [ ] Import and export layout, and line length, enforced by lint
- [ ] `<List>` builds list items straight into a list element, with no wrapper

## Progress Log

- 2026-09-26: Created from the "Open items" table in `proposals/README.md`
  when the finished proposals were archived.
- 2026-09-26: Boids allocation fixed (361 KB to 34 bytes per frame); see the
  Fix item.
- 2026-09-27: Added the unexplained fractional-number boxing (Investigate),
  and fixed the related boxing in the JSX runtime's watched props.
- 2026-09-27: Added the views that read a query binding's getter only once
  (Fix), found by sweeping the views for V-reactive violations after the
  architecture bindings page was rewritten in terms of query and relay
  bindings.
- 2026-09-27: 018's Fuel Run pilot fixed Fuel Run's six read-once views,
  three of which the first sweep had missed. Fuel Run's method-syntax members
  were converted in the same pass, and `method-signature-style` is enforced
  there. Fuel Run also now allocates about 270 bytes per frame, down from
  2.7 KB (see the hot-path allocation item).
- 2026-09-27: 018's migration of `common/` fixed the overlay's read-once
  size and converted `common/`'s method syntax; added the overlay's
  `requestAnimationFrame` item (Fix).
- 2026-09-27: 018's remaining migrations (demos, cabinet, six games)
  finished the read-once views and the method syntax, both now done. Added
  the cabinet's self-playing zoom transitions (Fix).
- 2026-09-27: Fixed Crumb Chase's allocation (a model cause, not a view one), the
  overlay's `requestAnimationFrame` release, and the cabinet's self-playing
  transitions. Added the short-press question (Decide).
- 2026-09-27: Archived 020 (falling sand as an implementation lab) and took
  in its follow-ups: the getter-literal finding (Investigate) and its
  experiments (Experiments).
- 2026-09-30: Added the multi-line imports and exports, and the missing line
  length (Fix), from a review of 022's changes.
- 2026-09-30: Added the one-`_mvt`-record experiment (Investigate), from a
  review of 022's scene passes.
- 2026-10-02: Closed the one-`_mvt`-record item, measured by 027 section
  11.8. Took in task 028's loose ends: 027's unbuilt dev checks and old
  playground links (Decide), and the DOM churn cost and Pixi's texture cache
  warnings (Investigate). Its publishing items went to 011's phase 6.
  Added the two unattributed slowdowns found re-saving the benchmarks
  (Investigate).
- 2026-10-03: 031 renamed the tick API (`setTickMethods` and `tickScene`
  became `setUpdate`, `setRefresh`, `updateView` and `refreshView`; the two
  counters became `tickCounter`) and retired "scene pass". Updated the
  pending items' names to match; the history above keeps the names of its
  day.
- 2026-10-04: The games were renamed and redrawn. Updated every mention
  here to the new names, history included.
  The cache-warnings item narrowed: `ghost-eyes` no longer collides.
- 2026-10-04: Closed and archived 011 (multi-package repo) and took in its
  loose ends: Vite's config-loader warning (Fix), an allocation budget check
  in place of the per-tick allocation lint rule (Investigate), and
  publishing `@mvtjs/eslint-plugin` and re-adding `www.yortus.com`
  (Parked).
- 2026-10-04: Added `<List>` wrapping its items inside a list element (Fix),
  found building the fruit machine demo (033).
- 2026-10-04: Added `<List>` item views' update steps seeing last frame's
  item (Fix), found reviewing the empty-slot update fix made for 034.
- 2026-10-07: Added Pixi's pooled `BatchableGraphics` keeping `roundPixels`
  (Fix), found by 042's spike.
- 2026-10-11: Added the hand-written time-stepping helpers that the tick
  API's new `advanceTime` covers (Fix), found while giving it its
  variadic form (042).
- 2026-10-18: Closed Vite's config-loader warning, already fixed on
  2026-10-16.
- 2026-10-18: Replaced the hand-written `stepMs` helpers with
  `advanceTime`, in the docs and four test files.
- 2026-10-18: Renamed Fuel Run's and Galaxy Raiders' ship textures, which
  shared names in Pixi's cache, and added a test against it.
- 2026-10-18: A benchmark suite with a failed case is no longer saved, so
  an interrupted `all --save` can't empty the results.
- 2026-10-18: Measured the line lengths again for the import and line
  length item. The code has outgrown 120 columns, so the length to enforce
  needs the owner's decision first.
- 2026-10-18: A `<List>` item view's update step sees the current item.
  The A/B found a 3% cost from filling a cache field early, now avoided.
- 2026-10-18: Split the finished items out into
  [017a](../../archive/017a-misc-loose-ends-done.md), with their ticked criteria. This
  log keeps the history of both.
- 2026-10-18: `www.yortus.com` works, so its parked item moved to 017a.
- 2026-10-18: Dropped the parked item to publish `@mvtjs/eslint-plugin`.
  Its only rules of use outside this repo are `no-wall-clock` and
  `no-module-state`, too few to be worth publishing and keeping up, and the
  playground can load them from source.
- 2026-10-18: Drain-the-tail was built on 2026-09-30 (`aa1f37fc`), but its
  parked item was never ticked. Moved to 017a.
