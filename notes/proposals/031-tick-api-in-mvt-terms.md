# Proposal: the tick API in MVT's own words

> Rename the tick API before the first publish, so it speaks in MVT's core
> terms (view, update, refresh) instead of "scene", "tick methods" and
> "scene pass". The host calls `updateView` and `refreshView`; views call
> `setUpdate` and `setRefresh`. Each is defined once in `@mvtjs/utils` and
> typed to every installed renderer's views through a `RendererViews`
> interface that renderer packages augment, so a program using two renderers
> no longer has two `tickScene`s. The two counters merge into one, `FrameStats`
> becomes `PerformanceMetrics`, and "scene pass" and the "walk" vocabulary
> give way to plain CS terms.

**Status:** decided 2026-10-03, in a design session that revisited 027-029.
The type and runtime questions were spiked the same day (section 7) and
found no blockers. Not implemented. **Blocks 011's first publish:** every
name here is public API, and the counter fields and `_mvt` node fields are
shared between copies of the packages (`copies.ts`), so renaming them after
a publish costs a protocol bump.

**Written:** 2026-10-03, against `vnext-011` (`c37ad7f` plus 011's staged
phase 5-6 work). Spiked with TypeScript 5.9.3, tsdown 0.23.0 (rolldown
1.2.12) and Node 26.10.

**Related:** [scene-passes.ts](../../packages/utils/src/scene-passes.ts),
[scene-counter.ts](../../packages/utils/src/scene-counter.ts),
[read-counter.ts](../../packages/utils/src/read-counter.ts),
[shared-state.ts](../../packages/utils/src/shared-state.ts),
[copies.ts](../../packages/utils/src/copies.ts),
[container-mixin.ts](../../packages/pixi/src/container-mixin.ts),
[object3d-mixin.ts](../../packages/three/src/object3d-mixin.ts),
[element-mixin.ts](../../packages/html/src/element-mixin.ts),
[frame-stats.ts](../../packages/pixi/src/frame-stats.ts),
[perfmon-view.tsx](../../site/src/shared/perfmon-view.tsx),
[JSX attributes](../../packages/utils/src/jsx/attributes.ts),
[eslint.config.js](../../eslint.config.js),
[renderer-tick-api.test.ts](../../checks/renderer-tick-api.test.ts),
[027](../archive/027-mvt-method-names.md) (sections 0, 7.2, 12.4, where the
current names were chosen), [028](../archive/028-tick-api-migration.md),
[029](../archive/029-rename-ontick-to-settickmethods.md),
[030](../archive/030-self-describing-perfmon.md) (perfmon labels),
[011](./011-multi-package-repo.md) (publishing),
[Glossary](../../docs/reference/glossary.md).

---

## 1. Summary

| # | Decision | Section |
| --- | --- | --- |
| 1 | The host calls `updateView(view, deltaMs)` and `refreshView(view)`. There is no combined `tickView`, and no `only` option | 3.1 |
| 2 | Views call `setUpdate(view, fn)` and `setRefresh(view, fn)`, beside the existing `hasUpdate` and `hasRefresh`. `setTickMethods` goes | 3.2 |
| 3 | JSX keeps `onUpdate={fn}` and `onRefresh={fn}` | 3.3 |
| 4 | Each function is defined once in `@mvtjs/utils`, typed through a `RendererViews` interface that each renderer package augments, and re-exported unchanged by every renderer | 3.4 |
| 5 | Renderer authors call one `registerRenderer`, replacing `createScenePasses` and `installFieldDefaults` | 3.5 |
| 6 | One counter, `tickCounter`, with `countTick(run)` and `TickCounts`, absorbs `readCounter` and `sceneCounter` | 4.1 |
| 7 | `FrameStats` becomes `PerformanceMetrics`. It reads the counter itself, and its metric names match the counter's fields | 4.2 |
| 8 | `PerfmonView` takes the rows to show | 4.3 |
| 9 | "Scene pass" and "scene" are retired. "Walk" and "node visit" are used only in their usual CS sense; the cached list is a "method list", which is "invoked" | 5 |
| 10 | Alternatives considered and rejected | 6 |

## 2. Why revisit

The 027-029 API worked, but three things stood in the way of publishing it:

- **`tickScene` used a new noun, "scene",** for what MVT already calls a
  view. Its first argument was a view. The docs then needed a second new term,
  "scene pass", for each half of it.
- **`setTickMethods(view, { refresh })` is long.** Its options object also
  carried a rule of its own: a member left out is kept, and a member given as
  `undefined` is cleared.
- **Each renderer exported its own `tickScene` and `setTickMethods`,** typed
  to its own nodes. A program with two renderers had to rename one on import.
  The boids-3d demo does exactly that:
  `import { tickScene as tickElements } from '@mvtjs/html'`.

## 3. The API

### 3.1 Ticking a view

```ts
ticker.add(() => {
    const deltaMs = ticker.deltaMS;
    cabinet.update(deltaMs);            // models
    updateView(app.stage, deltaMs);     // every update method in the view, parents first
    refreshView(app.stage);             // every refresh method in the view, parents first
});                                     // then the renderer draws
```

**No `tickView`.** A combined call would be sugar for update-then-refresh,
which the docs teach throughout and which a host writes once. Spelling out
the two calls makes the host's loop look like MVT's loop, and leaves "tick" as
the name for one turn of that loop rather than for one function in it.
Without `only`, the discriminated union that made a refresh-only call take no
`deltaMs` also goes.

What it costs:

- **Nothing enforces the order.** A host that refreshes before it updates
  draws everything a frame late, which is a subtle bug. It is written once per
  host, in the place the docs show most often.
- **Full ticks in tests take two lines.** 21 of the 31 full-tick calls are in
  tests. Most test calls, though, refresh alone, and those get shorter:
  `refreshView(cabinet.view)` instead of
  `tickScene({ root: cabinet.view, only: 'refresh' })`.

What it makes easier:

- **Fast-forward** is a plain loop: `updateView(tempStage, step)` for each
  step, then one `refreshView(tempStage)`.
- **Pausing** can be `if (!paused) updateView(game, deltaMs)`, as well as the
  gating the host uses today.

**Positional arguments.** With `only` gone, the options object has no job
left. The two arguments have different types, so they can't be swapped
silently. The "factories take named parameters" rule is about factories.

**Unchanged behaviour:**
- Parents run before children; sibling order is unspecified.
- A method may return `SKIP_DESCENDANTS`.
- `refreshView` refreshes what its methods attach before it returns.
- In dev builds, a `deltaMs` that isn't finite throws. The message names
  `updateView`. Negative values are still allowed.

### 3.2 Giving a view its steps

```ts
setUpdate(view, update);
setRefresh(view, refresh);
setRefresh(slot, (own) => (isPresent() ? own?.() : SKIP_DESCENDANTS)); // wraps the method it replaces
setRefresh(view, undefined);                                            // clears
hasUpdate(view); hasRefresh(view);
```

The rules carry over from `setTickMethods`, member by member:
- `undefined` clears the method.
- A method that declares a parameter for the one it replaces (one for refresh,
  two for update) wraps it.
- Both setters return `void`.

**Why two setters, not one.**
- **The common case is shorter.** Most of the roughly 73 `setTickMethods`
  calls set `refresh` alone, and `setRefresh(view, refresh)` beats
  `setTickMethods(view, { refresh })`.
- **The rule about members left out disappears,** because there are no
  members.
- **The names complete a grid with the existing `has*` functions,** so each
  name can be guessed from the others:

| | set | has | run on a view |
| --- | --- | --- | --- |
| **update** | `setUpdate` | `hasUpdate` | `updateView` |
| **refresh** | `setRefresh` | `hasRefresh` | `refreshView` |

The combined form had one real advantage: the shorthand `{ update, refresh }`
nudged everyone to name their local functions `update` and `refresh`. The repo
already ignores that nudge in places (`{ refresh: updateBanner }`).

### 3.3 JSX

`onUpdate={fn}` and `onRefresh={fn}` keep their names. 027 section 7.2's
reasons hold up under a fresh stress test:

- **In this JSX, a function given to a non-`on` attribute is a getter**
  (`x={() => model.x}`). `refresh={fn}` would read as "refresh is computed by
  `fn`". It would also look like it overrides real methods, such as Pixi's
  `AnimatedSprite.update`.
- **`onRefresh` is not the element's refresh method.** It adds a step after
  the element's bindings, and that step is skipped while `visible` hides the
  element, so "on" describes it accurately. A `ref` that calls `setRefresh`
  would replace the bindings instead.
- **The objection that "on" suggests calls adding up doesn't apply here.**
  JSX attributes are given once.

This mirrors the DOM, where the property is `el.onclick =` and the JSX
attribute is `onClick={}`. Here the functions say `set`, and the attributes
say `on`.

**Known weakness.** In the html and three.js JSX, `on*` attributes add event
listeners. A custom event named `update` or `refresh` therefore can't be
listened to from JSX. Use `ref` and `addEventListener`.

### 3.4 One definition, typed by the installed renderers

`@mvtjs/utils` declares an empty registry, and each renderer package adds its
view type to it:

```ts
// @mvtjs/utils
export interface RendererViews {}
export type View = [keyof RendererViews] extends [never]
    ? 'No renderer is installed: import a renderer package, such as @mvtjs/pixi'
    : RendererViews[keyof RendererViews];

export function updateView(view: View, deltaMs: number): void;
// refreshView, setUpdate, setRefresh, hasUpdate and hasRefresh take a View too

// @mvtjs/pixi, in container-mixin.ts
declare module '@mvtjs/utils' {
    interface RendererViews { pixi: Container }
}
```

**The registry is keyed by renderer, not by overloads.** It merges cleanly,
and the union is exactly the installed renderers' view types. With none
installed, the parameter type is a sentence. The error then reads:
"Argument of type 'Container' is not assignable to parameter of type '"No
renderer is installed: import a renderer package, such as @mvtjs/pixi"'".

**Runtime.** `registerRenderer` (section 3.5) stores the renderer's walk on
its node prototype, in a `_mvt` field. That field takes over from
`_mvtInvalidators`, which already gives every node a way back to its tree's
invalidation. `updateView` and `refreshView` read the field once per call and
pass the view to that renderer's walk. The spike measured about 3 ns per call
(section 7.3). In dev builds, a value from no installed renderer throws,
naming its class.

**Every renderer re-exports the same bindings.**
[renderer-tick-api.test.ts](../../checks/renderer-tick-api.test.ts) already
holds the renderers to that. Code that uses a renderer imports the tick API
from it. Lint holds the site to this (`TICK_API_FROM_RENDERER` gets the new
names), and it also avoids the version-mismatch case in section 7.2. Because
it is one function, importing it from two renderers is no longer a clash.

**Every published entry of a renderer package imports its mixin module,** at
least for its side effect, so that the entry's `.d.ts` brings the
augmentation with it. The spike found that an entry which uses the mixin only
in its implementation, as the JSX entry does, otherwise loses it (section
7.2).

**Consequences:**
- **The types are program-wide.** In the repo's site, where all three
  renderers are installed, `View` is `Container | Object3D | Element`
  everywhere, so a Pixi game could pass an `HTMLElement` to `updateView`
  without a type error. At runtime that call works anyway, because the html
  renderer is registered.
- **Inside `@mvtjs/utils`, no renderer is installed,** so `View` is the
  message type there. Its own code casts, and its tests augment `RendererViews`
  for a test renderer built on a plain prototype.

### 3.5 For renderer authors

```ts
const { invalidate } = registerRenderer({
    prototype: Container.prototype,
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: (node) => node.label,
    flushChanges: undefined,   // html: flush the MutationObserver's records before reading the tree
});
```

One call replaces two:
- `createScenePasses` built a renderer's walk;
- `installFieldDefaults` put the field defaults on its prototype.

Now that the walk is found through the prototype, those happen together.

`flushChanges` replaces `beforeScenePass`. It is named for what the DOM
renderer does with it, not for when it runs. A second copy of a renderer
package that registers the same prototype gets the first copy's
registration, as `shareAcrossCopies` arranges today. The exact shape, and how
it composes with `shareAcrossCopies`, is settled during implementation
(section 8).

### 3.6 Removed exports

| Removed | Replaced by |
| --- | --- |
| `tickScene`, `TickSceneOptions`, `only` | `updateView`, `refreshView` |
| `setTickMethods`, `TickMethods` | `setUpdate`, `setRefresh` |
| `readCounter`, `countReads`, `sceneCounter`, `countScene`, `SceneCounts` | `tickCounter`, `countTick`, `TickCounts` (`addReads` stays) |
| `createFrameStats`, `FrameStats`, `FrameStatKind`, `SampledCounter`, `SampledSceneCounter` | `createPerformanceMetrics`, `PerformanceMetrics`, `MetricKind` |
| `createScenePasses`, `ScenePasses`, `SceneTree`, `installFieldDefaults`, `beforeScenePass` | `registerRenderer` and its option and result types |

## 4. Measuring

### 4.1 One counter

```ts
addReads(n);          // hand-written views count their reads, as before
countTick(run);       // => TickCounts: for tests and benchmarks
tickCounter;          // { isCounting, ...TickCounts }: for samplers such as PerformanceMetrics

interface TickCounts {
    readonly reads: number;
    readonly methodCalls: number;
    readonly methodListRebuilds: number;
    readonly rebuildNodeVisits: number;
}
```

`readCounter` counts binding reads, and those happen during `refreshView`.
Both counters therefore measure the work of a tick, so they merge:

- **The per-frame cost doesn't change.** The hot sites (the JSX refresh code
  in `refresh-copies.ts`, `refresh-builder.ts` and `list.ts`, and the walk)
  each check a flag on one long-lived object and add to a field. The merged
  counter is the same: `if (tickCounter.isCounting) tickCounter.reads++`.
- **One on/off switch is enough.** `createFrameStats` already switches both
  counters on and off in the same frame. Tests that count only reads will now
  count method calls too, which costs nanoseconds and doesn't change the read
  counts they compare.
- **It's free now.** Both counters live in `utilsState`, which copies of
  `@mvtjs/utils` share across versions. Their field names are part of the
  protocol between copies, so renaming them after a publish would need a
  protocol bump.

**Names.**
- `countTick(() => refreshView(view)).reads` reads naturally even when `run`
  is half a tick, or many ticks, as in the falling-sand scaling benchmark.
- `tickCounter` could be misread as a frame number. Its only direct users are
  samplers, and its field names make clear what it counts.
- The exports drop from six (`readCounter`, `addReads`, `countReads`,
  `sceneCounter`, `countScene`, `SceneCounts`) to four.

### 4.2 `PerformanceMetrics`

`createFrameStats` becomes `createPerformanceMetrics({ renderer, ticker })`:

- **The counts become metrics** alongside fps, CPU time and GPU time.
- **It reads `tickCounter` itself,** so callers no longer pass counters in,
  and `SampledCounter` and `SampledSceneCounter` go.
- **Each metric now has one name.** Today a single quantity has three names
  (`readsPerFrame`, `'reads'` and `count`). From now on the property, the
  `historyAt` key and the counter field match:

```ts
type MetricKind = 'fps' | 'cpuMs' | 'gpuMs' | 'reads' | 'methodCalls' | 'methodListRebuilds' | 'rebuildNodeVisits';
metrics.reads;                          // per frame, as cpuMs already is without saying so
metrics.historyAt('methodCalls', i);
```

It stays in `@mvtjs/pixi`, because CPU and GPU timing hook Pixi's renderer.
Its "per frame" is accurate: it samples once per Pixi frame. This is the one
place the API says "frame".

**On the name:**
- `PerformanceMetrics` says why you'd want it, and "metric" is the plain word
  for each row.
- It sounds like the DOM's `Performance*` family, but `lib.dom` has no
  `PerformanceMetrics`.
- `FrameMetrics` (shorter, but names the unit, not the purpose) and
  `PerfMetrics` (an abbreviation) were the alternatives.

### 4.3 Perfmon rows

Once the metrics always measure reads, something has to say when a count
means nothing. The boids demo leaves out `readCounter` on purpose: its
hand-written views don't call `addReads`, so its reads would show a false 0.

`PerfmonView` therefore takes the rows to show. Which rows a demo can
measure honestly is a display decision, so it belongs in the view. Boids can
add `addReads` calls later if it should be compared with JSX.

## 5. Vocabulary

### 5.1 Terms

| Term | Meaning | Where it appears |
| --- | --- | --- |
| **view** | A view, including its child views | `updateView`, `refreshView`, `RendererViews` |
| **update / refresh** | MVT's two steps; a view's **update method** and **refresh method** | Everywhere |
| **tick** | One turn of the ticker's loop: the models update, then the views update, then the views refresh | Docs; in the API only `countTick`, `tickCounter`, `TickCounts` |
| **frame** | One displayed frame | `PerformanceMetrics` only |
| **walk** | Traversing the renderer's tree, in the usual CS sense (CLRS's "preorder tree walk"): rebuilding a method list, or invalidating up to the root | Perf docs, design notes, code |
| **node visit** | One event of a walk reaching a node. The verb is "visit"; the node is a "visited node" in prose | `rebuildNodeVisits` |
| **update / refresh method list** | The cached preorder list of the nodes in a subtree that have a method of that kind, with their methods and a skip table. "Method list" when the kind is clear | `MethodList<N>`, `methodListRebuilds` |
| **entry** | One element of a method list | Code |
| **invoke** | Going through a method list, calling its entries' methods in order | Perf docs, code |
| **call** | One method being called | `methodCalls` |
| **rebuild** | Remaking a method list after the tree changes | `methodListRebuilds`, `rebuildNodeVisits` |
| **invalidate** | Clearing cached method lists, walking up to the root | `invalidate` |
| **skip table** | For each entry, the index just past its subtree | Code |
| **elision** | What a refresh invocation left out, recorded so it can catch up if the tree changes during it | Code only |
| **cached** | Used in prose instead of "memoised" | Docs |

### 5.2 Retired terms

**"Scene pass" and "scene".** With each half of a tick named in the core
terms, "scene pass" only restates the two functions, and both its words are
borrowed jargon ("scene" from scene graphs, "pass" from render passes). The
user docs use it 56 times in 12 files, and every use checked rewrites to
something shorter with no new noun:

| Today | Without the term |
| --- | --- |
| The update scene pass finds every update method in the tree, however deep | `updateView` finds every update method in the view, however deep |
| return `SKIP_DESCENDANTS` to skip its descendants for that scene pass | ...to skip its descendants for that call |
| A container added during the refresh scene pass is refreshed before that scene pass returns | A container added during `refreshView` is refreshed before `refreshView` returns |
| the host gates its game container out of the update scene pass | the host leaves its game container out of `updateView` |

The architecture docs, which are meant to apply beyond this repo, can say
"the ticker updates the model, then updates the view, then refreshes the
view". The sentence has the same shape for models and views. Models forward
`update` to their children by hand; the library finds every view's methods
for it.

**Other retired terms:**
- **"Memoised walk"** named the cached list a "walk", which is wrong in graph
  theory (a walk's consecutive vertices must be adjacent, and the filtered
  list skips nodes) and a stretch in CS (where a walk is the act, not its
  output).
- **"Run"** (for going through a method list) clashed with `countTick(run)`
  and with every other use of "run".
- **"Climb"** was a third word for traversal.
- **Bare "visit" as a noun** was too vague.

### 5.3 Identifier renames

| Now | After |
| --- | --- |
| `SubtreeWalk<N>`, `buildSubtreeWalk` | `MethodList<N>`, `buildMethodList` |
| `_mvtUpdateWalk`, `_mvtRefreshWalk` | `_mvtUpdateMethodList`, `_mvtRefreshMethodList` |
| `invokeSubtreeMethods(walk, ...)` | `invokeMethodList(list, ...)` |
| `nestedWalks`, `firstWalk` | `nestedInvocations`, `outerList` |
| `walkRebuilds`, `rebuildVisits` | `methodListRebuilds`, `rebuildNodeVisits` |
| `_mvtInvalidators` | Folded into the renderer field (section 3.4) |
| "invalidation climbs" | "invalidation" |
| `updateScene`, `refreshScene` (internal) | The internals of `updateView` and `refreshView` |

## 6. Rejected alternatives

Do not reopen these without new information.

| Alternative | Why not |
| --- | --- |
| `tickView(view, deltaMs)` | Sugar for two calls that a host writes once; keeping it would keep "tick" as a function name (3.1) |
| `view(x).update(dt).refresh()` | `view` is the most common local variable name in the repo, so the import would be shadowed. It also allows `.refresh().update()`, silently skips the refresh if the last call is forgotten, and needs a per-frame object or a hidden shared cursor |
| `useTicker(view)...` | `use*` brings React hook rules with it, and it gets the direction backwards: the ticker uses the view |
| `whenTicked(view, ...)`, chained or not | Reads like a one-shot promise, and event wording suggests calls add up when they replace (027's runner-up, for the same reason) |
| `onTick` | `on*` names relay bindings and event handlers here (029) |
| Combined `setX(view, { update, refresh })` under any name | The rule about members left out, longer common case (3.2) |
| `update.set` / `refresh.set` namespace objects | 32 site files declare a local `refresh`, and 10 an `update`. TypeScript rejects an import that clashes with a local declaration, so `refresh.set(view, refresh)` could never be written. It also groups by step, not by audience: a view would import `run`, and the host `set` |
| JSX `update={}` / `refresh={}` | Breaks "a function on a non-`on` attribute is a getter" (3.3) |
| JSX `ref={(el) => setRefresh(el, fn)}` | Replaces the bindings instead of adding a step after them |
| JSX `mvt:update={}`, `tick={{ update, refresh }}` | Unfamiliar syntax; the combined shape again |
| `frameCounter` | Reads as a frame number (Unity's `Time.frameCount`, three's `renderer.info.render.frame`). The counter is switched on around arbitrary code, not frames, and a tick is not a frame (fast-forward, thumbnails, tests) |
| "update pass" / "refresh pass" | Keeps the bespoke "pass" |
| "view update" / "view refresh" as nouns | "A view's update" already means its own method |
| "update phase" / "render phase" | Clashes with domain state (`CabinetModel`'s `phase`), and suggests one global stage of the frame |
| "call list", "run order", "plan", "preorder list", "schedule" | Each is less clear than "method list" in the sentences the docs need |
| "visited node" as the counter's term | The counter counts events. The update and refresh lists are rebuilt by separate walks, so one node can be visited more than once a frame |
| Unqualified "list", "visit" | Too vague |
| Per-renderer `tickScene` / `setTickMethods`, typed to each renderer (the status quo) | The name clash in programs with two renderers (section 2) |

## 7. Spike

### 7.1 Setup

The spike was done in a scratch directory outside the repo, and not kept.
It had three small packages:
- **`@mvtjs/utils`:** `RendererViews`, `View`, the six functions,
  `registerRenderer`, and prototype dispatch over an unmemoised walk.
- **`@mvtjs/pixi` and `@mvtjs/three`:** each has a mixin that augments
  `RendererViews` and registers a stand-in renderer library's node prototype,
  plus a `./jsx` entry.

They were built as the repo builds its packages:
- tsdown with `unbundle`, `dts`, `publint` and `attw`;
- `@mvtjs/source` exports;
- the repo's compiler options.

Consumer projects then received copies of the built packages in their
`node_modules`, and were checked with `tsc` and run with Node. The real
memoised walk and `shareAcrossCopies` were not part of it. Prototype dispatch
uses the same mechanism `_mvtInvalidators` already uses.

To repeat it, rebuild that layout. Each scenario below is one consumer
directory.

### 7.2 Results

| Scenario | Result |
| --- | --- |
| `declare module '@mvtjs/utils'` in a mixin, built by tsdown | Kept verbatim in the mixin's `.d.ts`. attw and publint report nothing |
| Augmenting `RendererViews` when utils' `index.d.ts` only re-exports it from another file | Works |
| A renderer entry whose `index.ts` only does `import './object3d-mixin'` | The side-effect import is kept in its `.d.ts`, so the augmentation reaches consumers |
| A program that imports only `@mvtjs/pixi/jsx` | **Fails** while the JSX entry uses the mixin only in its implementation, because its `.d.ts` then doesn't import the mixin's. Passes once the entry adds `import '../container-mixin'`. Hence the rule in 3.4 |
| No renderer installed | The error in 3.4, as designed |
| A plain object, or another renderer's node when only one is installed | Rejected |
| Two renderers | Both renderers' nodes are accepted by either renderer's re-export |
| In-repo mode (`customConditions: ['@mvtjs/source']`, resolving to `src/*.ts`) | Passes |
| `module` / `moduleResolution: node16` | Passes |
| A nested second copy of `@mvtjs/utils` of the **same** version | Passes: TypeScript deduplicates packages with the same name and version |
| A nested second copy of a **different** version | Importing `updateView` from `@mvtjs/utils` misses the augmentation (the no-renderer error). Importing it through `@mvtjs/pixi` passes. Rare, because utils is a peer dependency, and avoided by importing from the renderer (3.4) |
| Runtime: one `updateView` / `refreshView` on a Pixi tree and a three.js tree | Each dispatches to its own renderer, parents first |
| Runtime: two module instances of utils, at different versions | The app's copy ticks a tree registered through the renderer's nested copy |
| Runtime: a renderer known to the types but never loaded (what `import type` alone does) | The dev error: "is not a view of any installed renderer. Import its renderer package..." Its wording needs fixing ("a Object3D"), and `null` reaches a raw `TypeError`, so the check should guard it |

### 7.3 Cost

The spike timed `refreshView` on two empty roots, one per renderer, so the
call site sees two prototypes. Comparing dispatch with a direct call to each
renderer's walk, over 7 interleaved rounds after a warm-up, on Node 26:

| | Median per call |
| --- | --- |
| Dispatch | 4.7-4.9 ns |
| Direct | 1.6 ns |
| **Difference** | **3.1-3.3 ns** |

A host makes 2 to 4 such calls per frame. That's around 10 ns per frame, so
no benchmark run is needed.

## 8. Open questions

1. **The exact shape of `registerRenderer`,** and how it composes with
   `shareAcrossCopies`, which today keys a renderer's shared core on its
   prototype by package name. To be decided during implementation, keeping
   one `_mvt` field per prototype for dispatch.
2. **A check that every published entry brings its augmentation.**
   Augmentations apply program-wide, so one program can't test them per
   entry. A check would compile a small consumer per entry against the built
   `dist`, as the spike did. Recommended, in `checks/` or as part of
   `build:packages`; the cost is a few `tsc` runs.
3. **Task 030's perfmon labels against the new metric names.** The labels are
   display text and can stay short. Check that nothing keys on the old names.

## 9. Implementation steps

1. ~~Spike the types, packaging and dispatch.~~ Done (section 7).
2. **utils core.**
   - `updateView`, `refreshView`, `setUpdate` and `setRefresh`;
   - `RendererViews` and `View`;
   - `registerRenderer`, with the renderer field on the prototype in place of
     `_mvtInvalidators`;
   - the dev errors, with `null` guarded and the wording fixed.

   Then each renderer's mixin registers and augments, and every published
   entry imports its mixin. `PROTOCOL` stays 1, since nothing is published.
3. **Measuring.**
   - `tickCounter`, `countTick` and `TickCounts` in place of the two counters,
     including the generated JSX refresh code (`generate-refresh-copies.ts`)
     and `utilsState`;
   - `createPerformanceMetrics` and `MetricKind`;
   - `PerfmonView`'s rows, and the boids and falling-sand entries.
4. **Internal vocabulary.** The renames in 5.3, and the comments in
   `scene-passes.ts` (which might itself become `tick.ts` or `method-lists.ts`)
   and the mixins.
5. **Call sites.** Mentions of `setTickMethods` (95 in the site, 32 in
   benchmarks) and `tickScene` (55 and 25), including the playground's
   presets and the names its sandbox exposes (`editor-panel.ts`, `presets.ts`,
   `sandbox-runner.ts`), and the package tests.
6. **Lint and checks.** `TICK_API_FROM_RENDERER` lists the new names.
   `renderer-tick-api.test.ts` keeps holding the re-exports to the same
   bindings. Add the check in open question 2 if adopted.
7. **Docs.**
   - "Scene pass" appears 56 times in the docs and 7 in AGENTS.md, and the
     old function names about 80 times in the docs;
   - the glossary entries (`Scene pass`, `tickScene` and `setTickMethods`
     become `updateView`, `refreshView`, `setUpdate` and `setRefresh`);
   - AGENTS.md, the skills and `llms.txt`;
   - the package READMEs and the pixi design notes;
   - the walk wording in
     [why-not-just-update.md](../../docs/articles/why-not-just-update.md).
8. **Changelog.** Nothing is published yet, so this is part of the first
   release's notes, not a changeset of its own.
