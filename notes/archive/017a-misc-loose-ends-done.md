# Miscellaneous Loose Ends: Finished

| Field     | Value      |
| --------- | ---------- |
| Created   | 2026-09-26 |
| Completed | 2026-10-18 |

## Description

The items of task [017](../tasks/backlog/017-misc-loose-ends.md) that are
finished, moved here on 2026-10-18 so that 017 lists only what is still
open. Each item says when and how it was done, and keeps its sections from
017. Their history is in 017's progress log.

### Fix

- ~~**Boids allocates about 360 KB per frame**~~ Done 2026-09-26: now about
  34 bytes, and about one collection a minute. Five causes, measured one at a
  time: the view redrawing every boid into one `Graphics` (about 270 KB; now
  a pooled `Graphics` per boid over a shared `GraphicsContext`), the sliders
  redrawing unchanged (about 50 KB; now gated on change), getters on the boid
  record making the model's writes box numbers (about 34 KB; now plain
  fields), a `random()` function called per boid (3.2 KB; now an inline
  generator over a `Uint32Array`), and Pixi's `rotation` setter (3.2 KB;
  boids are now turned with `skew`). The model still takes about
  0.5 ms per frame comparing every pair of boids.

- ~~**Function members in types still use method syntax**~~ Done 2026-09-27,
  as part of 018's migrations: none are left, and `method-signature-style` is
  enforced on every TypeScript file. The variance errors expected below did
  not appear. Originally: method syntax in 537 places across
  120 files (about 310 in the games) as of 2026-09-26, against the style guide's
  "Function-Valued Properties in Types". Count them with
  `npx eslint --rule '{"@typescript-eslint/method-signature-style":["error","property"]}' src benchmarks scripts`.
  The lint rule's auto-fix converts them all; then enable the rule set to
  `'property'`. Type-check afterwards, since the stricter parameter checks may
  surface real errors. They are most likely around `SlotList<T>` and
  `OrderedSlotList<T>` in `packages/libraries/utils/src/slot-list/`, which take `T` as a
  parameter: converted, a `SlotList<Asteroid>` is no longer accepted as a
  `SlotList<GameObject>`. Prefer fixing code that relies on this; failing
  that, add a narrow, documented exception for generic collection interfaces
  (as TypeScript's own `Array<T>` makes).

- ~~**Views that read a query binding's getter only once.**~~ Done
  2026-09-27, by 018's migrations. Each declared a query binding as a
  function but read it only at construction, which rule
  [V-reactive](../../packages/sites/docs/architecture/rules.md#view-rules) forbids. Found
  by two sweeps (the second also caught reads inside constructor arguments):
  the overlay view's size; six Fuel Run views' sizes; Kwazy Cactii's
  `matchSequence` in five views; and, borderline, the asteroid view's radius
  and size, re-read only when its shape seed changed. All but the last are
  now fixed answers; the asteroid view now watches all three. Checked and
  live: the touch input, cabinet, cactus, and Burrow Bust and Galaxy
  Raiders enemy views.

- ~~**The overlay times its release with `requestAnimationFrame`.**~~ Done
  2026-09-27. It waited two animation frames before relaying
  `onRestartPressed(false)`, so that a model polling for the press would see
  it: wall-clock timing in a view. Now the release waits for the overlay's
  own `update(deltaMs)` step instead, which runs after the model's update in
  the same frame, so the model always sees the press first (with tests). The
  model-side fix suggested here was not taken: it would change seven games'
  input for restart alone, while every other button has the same race. See
  Decide.

- ~~**The cabinet view's zoom transitions play by themselves.**~~ Done
  2026-09-27. Its GSAP timelines are now paused and advanced by the view's
  `update(deltaMs)`, which `main.ts` now runs (`updateScene` over the
  cabinet view each tick; before, only game sessions ran it). Each timeline
  renders at time 0 when built, so its first frame shows every tween's start
  values. The carousel's eased scroll, which moved a fixed share of the way
  per refresh, so ran faster at higher frame rates, and in `refresh()`, now
  also advances in `update(deltaMs)`, scaled to match the old speed at
  60fps.

- ~~**An interrupted `npm run bench -- all --save` empties every results
  file.**~~ Done 2026-10-18. The driver already saved a suite only once its
  run ended, but it left a failed case out and saved the rest. Stopping a
  run stops its case processes, so each case failed, and every suite after
  it "finished" empty and was saved. Now a suite with a failed case is not
  saved, and keeps its last save. Checked by failing every case of
  `hot-path-rules --save --force`. Originally: stopping one partway through (2026-09-27, during its first suite)
  rewrote all nine `packages/tests/benchmarks/results/*.md` and `.json` files with their
  headers but no tables, removing about 4,000 lines; they were restored from
  git. A save should write only the suites that finished, or write nothing
  until the run is complete. Until then, save one suite at a time
  (`npm run bench -- <suite> --save`).

- ~~**Vite 8's config-loader warning.**~~ Done 2026-10-16, when the
  packages were grouped into folders: the config reads
  `import.meta.dirname`, and imports `./scripts/index.ts` with its
  extension. Checked on 2026-10-18 with `vite build`, which no longer warns.
  Originally: every Vite run warned that
  `packages/sites/arcade/vite.config.ts` uses two things its coming native config loader will
  not support: `__dirname` (use `import.meta.dirname`, as `vitest.config.ts`
  should too) and the extensionless import of
  `./scripts/vite-plugin-spritesheet`. The extension is the awkward one: the
  style guide's imports have none. Either config files get an exemption
  that says why, or the plugin moves somewhere the config can import by
  package name. From 011's phase 5 (Vite 8).

- ~~**A `<List>` item view's update step sees last frame's item.**~~ Done
  2026-10-18, with the suggested fix. A slot whose item view has an update
  step gets its gate as the view is built, and again as it empties, for one
  that gained an update step since. The gate looks the item up afresh, and
  the list reads its source in an update step of its own, before any
  slot's, so a getter's new collection is followed too. Five conformance
  tests cover the three cases below and the getter, and fail on the old
  code. The first version slowed the `arrays-sprites` A/B (20,000 grains)
  by about 3%, although its item views have no update steps. The cause was
  asking `hasNodeUpdateInSubtree` as each slot was built, which filled the
  method lists' cache field on every sprite earlier than `updateView` does,
  in another order among its fields. That check now reads the cache without
  filling it. Then four interleaved rounds each way were level: settled
  2,080 against 2,070 µs, and flipping 2,380 against 2,340 µs, within the
  rounds' spread. Originally: an item
  view reads its item through a cache that the slot's presence check fills
  during `refreshView`. `updateView` runs between the models' update and
  that refresh, so in the frame after the model removes or replaces an item,
  the item view's update step still gets the old one. Empty slots no longer
  run update steps at all (fixed 2026-10-04 for 034, by a gate each slot
  gets as it first empties). But the gate goes by presence at the last
  refresh, and is only added once the slot empties, so it never covers this
  frame. Nothing in the repo is exposed yet; it bites when:
  - **a value is torn down on release.** `SlotList`'s `onRelease` is
    documented for "return it to a pool, free resources". If a model resets
    a pooled value there, the update step reads a gutted object, or throws
    if a field it reads is now `undefined`.
  - **a value is recycled in the same model update**, as a pooled bullet is
    fired again from the gun. The stale reference now points at another live
    entity, and the old slot's cosmetic state follows it for a frame.
  - **an update step calls a relay binding with item data**, which the docs
    allow (reporting that a fade has finished). It reports a removed or
    replaced item: a second `SlotList.remove` of the same slot, or scoring
    or moving the wrong entity. The one case that is a logic bug, not a
    glitch.

  Suggested fix: update steps see the current item, as every view outside a
  list sees the model. Give the update gate to every slot whose item view
  has an update step from its first refresh, not from when it first
  empties. In `updateView` the gate looks the item up afresh with `at(index)`,
  stores it for the accessor, and skips the subtree when it is gone. Only
  lists whose item views have update steps pay: one `at()` per slot per
  frame, plus re-reading `items` once per frame when it is a getter. Tests
  for all three cases above; re-run the interleaved `falling-sand-scaling`
  A/B (`arrays-sprites`, 20,000 grains), which must stay level, since its
  item views have no update steps. The alternative is to keep last-refresh
  semantics and document the three hazards in `ListBindings.children`;
  cheaper, but a trap. See `gateUpdatesOnceEmpty` in
  `packages/libraries/utils/src/jsx/list.ts`, and 034 section 11.4.

- ~~**Hand-written time-stepping helpers that `advanceTime` now covers.**~~
  Done 2026-10-18: Time Management and the model skill teach
  `advanceTime`, and the four test files with a `stepMs` helper (the three
  below, and Fractalscope's `picture-view-model.test.ts`) await it instead.
  Originally: the
  tick API gained `advanceTime(ms, ...items)` (042, step 10). But
  `building-with-mvt/simulating-the-world/time-management.md` and
  `ai-agents/skill-mvt-model.md` still teach a hand-written
  `stepMs(model, totalMs)` helper, and three test files keep their own
  copy: `entries/boids/models/flock-model.test.ts`,
  `entries/kwazy-cactii/models/board-model.test.ts` and
  `packages/libraries/utils/src/sequence.test.ts`. Their helpers run synchronously,
  and `advanceTime` is async, so moving to it means awaiting each call.
  Teach `advanceTime` in both docs, and switch the tests.

### Decide

- ~~**Old playground links that assign `view.onRefresh`.** Since task 028, the
  assignment makes a plain property `refreshView` never reads, so a
  playground link saved before then loads without error and never animates.
  Since 031 the same holds for links that call `setTickMethods`, which the
  sandbox no longer provides: those at least fail with an error. The presets
  and the new-project template use `setRefresh`. A dev
  warning for a node with an own `onRefresh` or `onUpdate` property, in the
  playground's sandbox only, would point old links at the fix. Worth it only
  if old links are in circulation.~~ Done in 052 (step 10, 2026-10-17): the
  new playground converts an old link as it opens it, and the conversion
  makes each `x.onRefresh = f` a `setRefresh(x, f)` call, and each
  `x.onUpdate = f` a `setUpdate(x, f)` call, so those links animate again.
  Links that call `setTickMethods` still fail, with an error that names it.
  On 2026-10-17 the conversion was dropped, since the old playground was
  never publicised, so old links no longer open at all.

### Investigate

- **Related to 017's fractional boxing item, and fixed:** the JSX runtime's watched attributes boxed fractional
  `width` and `height` values every frame (16 bytes per element), changed or
  not, because their last value lived in a closure variable that started as
  a symbol. They now use a `Float64Array` (see
  `FRACTIONAL_WATCHED_ATTRIBUTES` in `packages/libraries/pixi/src/jsx/jsx-runtime.ts`), guarded by the `memory` suite's
  `allocation-watched` table.

- ~~**Pixi's "[Cache] already has key" warnings**~~ Done 2026-10-18: Fuel
  Run's ship textures are now `jet` and `jet-icon`, and Galaxy Raiders'
  `fighter` and `fighter-icon`, with the same pixels. A catalogue test fails
  when two entries have a texture of the same name. Originally: the
  warnings (`ship-icon`, `ship`) when
  the cabinet loads. Seen during task 028's browser checks, with `ghost-eyes`
  too until only Burrow Bust had an eyes texture. They predate the rework:
  Galaxy Raiders and Fuel Run register textures under the same names.
  Rename or share the textures.

- ~~**One `_mvt` record per node instead of six `_mvt*` fields.**~~ Done
  2026-10-02: measured by 027 section 11.8 (variant D, a single `_mvt` record
  under a named field), which was 4-7% slower at 100,000 containers and kept
  more memory per node, so task 028 kept the named fields. Originally: each
  renderer's scene passes add `_mvtUpdateMethod`, `_mvtRefreshMethod`,
  `_mvtSubtreeHasUpdate`, `_mvtUpdateWalk`, `_mvtSubtreeHasRefresh` and
  `_mvtRefreshWalk` to its node prototype (`installFieldDefaults` in
  `packages/libraries/utils/src/scene-passes.ts`), and a
  node gains them as own properties lazily, in whatever order it is used.
  Reads of them see every node class (`Container`, `Sprite`, `Graphics`,
  `Text`, and so on) and every order of those writes, so in a mixed scene
  their inline caches likely go megamorphic. The alternative: one own
  property, `_mvt`, holding a record made by one factory with all six fields
  set, so only `node._mvt` sees the node's class and every field read after
  it is monomorphic. It also means one hidden-class transition per node
  instead of up to six, one expando on DOM elements instead of six, and one
  `_mvt?: SceneMemo` field in each renderer's type augmentation. Its costs:
  an allocation (about 40 bytes) per node the scene passes touch, made on
  first use, and a second load per memo access. The steady-state frame
  would not change: since 012's cached methods, the per-frame loop reads the
  memo fields only on the node a scene pass starts from. Rebuilds,
  invalidation climbs and method assignment (JSX construction) would. To
  measure: add a mixed-class `churn` case to the `scene-passes` suite (the
  existing one uses plain `Container`s, which are already monomorphic),
  then A/B `scene-passes`, `construction` and `falling-sand-scaling`, as 012
  section 2.4 did for cached methods. Raised in review of 022's step 3
  (2026-09-30).

### Parked (pick up only when the trigger happens)

- ~~**Fold the `<List>` patterns guide into `docs/`.**~~ Done 2026-09-27,
  with 018's Building with MVT rewrite: it is now
  [Presenting Collections](../../packages/sites/docs/building-with-mvt/presenting-the-world/collections.md).

- ~~**Drain-the-tail**~~ Done 2026-09-30, in `aa1f37fc`, found 2026-10-18:
  `refreshView` refreshes, in the same call, whatever its methods attach or
  give a refresh method while it runs, for any container, not only `<List>`
  and `<Switch>` (`catchUpRefresh` in
  `packages/libraries/utils/src/tick-api/tick-api.ts`). It repeats until a
  round changes nothing, and throws past a limit. `updateView` leaves a
  container added during it to the next call, on purpose. Tests: "mutation
  during a call" in `packages/libraries/pixi/src/container-mixin.test.ts`.
  Originally: refresh containers added mid-pass on the same frame. Lower
  priority, because `<List>` and `<Switch>` already refresh what they build.
  Trigger: hand-written views start building children inside their methods.
  [001](001-mvt-plugin-rework-plan.md) section 13, item 1.

- ~~**`www.yortus.com`.**~~ Done, checked 2026-10-18: `www.yortus.com`
  resolves to GitHub Pages, its certificate (Let's Encrypt, until
  2027-01-03) names both `yortus.com` and `www.yortus.com`, and it redirects
  to the apex, so `https://www.yortus.com/mvt-games/` lands on
  `https://yortus.com/mvt-games/`. Originally: Dropped while GitHub's
  certificate requests for the site kept failing. Trigger: someone asks for
  it, or GitHub Support says the apex-plus-`www` certificate will issue.
  Re-adding the `www` CNAME makes GitHub request a new certificate for both
  names, so add it only once the apex one is in place and HTTPS enforced.
  011 section 13.3.

## Acceptance Criteria

- [x] Boids allocation fixed, or its cause measured and recorded
- [x] Method-syntax members converted and `method-signature-style` enabled
- [x] Views that read a getter only once fixed (V-reactive)
- [x] One `_mvt` record per node measured against six `_mvt*` fields, and adopted or recorded
- [x] Pixi's texture cache warnings fixed, or recorded as harmless
- [x] Vite's config-loader warning gone
- [x] A `<List>` item view's update step sees the current item, or the hazards are documented

## Progress Log

- 2026-10-18: Split out of 017, with its finished items.
