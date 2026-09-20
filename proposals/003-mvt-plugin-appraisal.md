# Appraisal: pixi-mvt-plugin spike

> Independent review of the spike in this folder. Verdict, business case, and
> technical findings. Written before the rework, so the documents it calls
> QUICK-START.md and README.md are now [README.md](../src/pixi-mvt-plugin/README.md) (the pitch) and
> [the design notes](./002-mvt-plugin-design-notes.md) (the rationale).

**Reviewed:** 2026-09-18, against Pixi 8.16.0, branch `pixi-mvt-plugin`.

---

## Verdict: thumbs up, narrowly, with a scope cut

Worth developing into a product. Not as the thing it currently is.

The spike ships three ideas. Only one of them is the product:

| Idea | Verdict |
| ---- | ------- |
| `onUpdate(deltaMs)` as a scene-scoped update pass | **The product.** Fills a real hole in Pixi with no incumbent. |
| `onRefresh()` as a render-decoupled refresh pass | Worth keeping, weak on its own. `onRender` already covers most of it. |
| Two interchangeable call-list strategies | **Cut.** The performance difference does not register against a frame budget. |

Recommended shape: two hooks, one strategy, eager mixin install, QUICK-START as
the front door. That is roughly a 40% code reduction with no measurable change
in behaviour, and it turns a spike into something maintainable.

The strongest single argument for `onUpdate` is not in the spike's own pitch:
it is the only thing that lets update-bearing views compose into declarative
JSX scenes at all. See [the JSX composition note](#b-mvt-devs-and-the-games-in-this-repo).

---

## Business case

### (a) General Pixi devs, no MVT knowledge

**`onUpdate` is the pitch, and it is a good one.** Pixi has no per-container
update hook. Today, time-based logic owned by a display object means
`Ticker.shared.add(fn)` plus remembering to remove it. Forgotten unsubscribes
are a well-known Pixi bug class: leaks, and ghost animations that keep running
after a scene is torn down. Scoping a subscription to scene-graph membership
eliminates the whole category. Developers arriving from Unity will recognise
`MonoBehaviour.Update` immediately, which is a marketing asset as much as a
technical one.

**`onRefresh` is a much weaker pitch, because `onRender` already exists.** The
README honourably retracts its own ordering argument. What survives is: works
without a renderer, is not suppressed by `cacheAsTexture`, and is not coupled
to render internals. The `cacheAsTexture` claim checks out against Pixi 8.16
(`RenderGroupSystem._updateRenderGroups` returns before recursing into nested
render groups when a cached texture is current). But that is latent-bug
prevention, not a felt pain, and it will not sell the library on its own.

**The adoption blocker is the monkey-patch, and it is not about performance.**
Measured cost of the prototype wrappers on trees that never touch a scheduler:

| | hz |
| --- | --- |
| unpatched Pixi, `addChild` + `removeFromParent` x100 | 147,122 |
| patched, no scheduler | 145,459 |

About 1%. The objection is trust, not speed. A meaningful share of teams will
refuse a library that patches `Container.prototype` process-wide, is invisible
in stack traces, and breaks silently if a future Pixi version adds a structural
method that does not delegate to the five wrapped ones. No benchmark fixes
that; only a track record does.

**Documentation sequencing.** QUICK-START is a genuinely good product document,
better than most released plugins ship with. Its one structural problem is
order: it leads with `onRefresh`, which is the philosophically load-bearing but
harder sell, and follows with `onUpdate`, which is the "I have this problem
today" hook. Lead with the pain.

### (b) MVT devs and the games in this repo

The honest answer here is less flattering than expected, and worth being blunt
about.

**`onRefresh` is already solved in this repo.** 59 files do
`view.onRender = refresh` and it works. `cacheAsTexture` is used nowhere in
`src/`. The migration would touch every one of those files to fix a bug the
repo does not currently have.

**`onUpdate` replaces surprisingly little plumbing.** `StatefulPixiView`
appears in 2 of 7 games (cactii and scramble). Total manual `update(deltaMs)`
forwarding across the repo: about 8 call sites, roughly 15 lines. Counted
purely as lines deleted, ~700 lines of implementation to remove ~15 is a bad
trade.

**The real argument is the failure mode, not the line count.** Every new view
with presentation state currently requires four coordinated edits: change the
return type to `StatefulPixiView`, `Object.assign(view, { update })`, add a
forwarding line in the parent, and add another in the grandparent
(`scramble/views/game-view.ts:215` to `cactii/views/game-view.ts:20` to the
game entry). Miss any link in that chain and the animation silently never
advances. No error, no failing test, and nothing in the type system catches a
missing forward in an intermediate view. That is an O(n) discipline tax whose
cost scales with how much visual polish the games acquire, and this repo has an
entire documentation section named "adding-visual-polish". That is the case
worth making, and it is a real one.

**Drain-the-tail buys this repo nothing today.** Every game builds fixed view
pools at init and binds them to model slots by index.
`scramble/views/game-view.ts` does exactly this six times over, for bullets,
bombs, rockets, UFOs, fuel tanks and explosions, each gated by an `isActive()`
binding. No view in the repo spawns child views during refresh. The swarm
demo's reconciliation pattern is not a pattern this repo uses anywhere. So the
most intricate machinery in the scheduler solves a problem the repo does not
have, though it is precisely the machinery you would need if you ever moved off
fixed pools.

**It unblocks update-bearing views in declarative JSX scenes, which is the one
benefit with no workaround.** The experimental `src/pixi-jsx/` runtime types
`JSX.Element` as `Container`, and `ListProps.to` as `(item, index) => Container`.
Every composition point in the runtime is therefore blind to a
`StatefulPixiView`, because the `& { update }` half of that type is erased the
moment the value enters a JSX tree. `addChildren()` just calls
`parent.addChild(child)`, and nothing upstream retains a handle on `.update()`.

The practical consequence is that an update-bearing view cannot simply be
written into a scene. It has to be instantiated separately, outside the tree,
so that a reference survives for manual tick forwarding, then spliced back in
by `ref` or by hoisting it above the JSX entirely. That is a second, parallel
construction path running alongside the declarative one, and it exists purely
so somebody can reach a method. `src/demos/tsx-pixi/demo-view.tsx` already
reaches for `ref` to escape into imperative access for a far smaller reason
(drawing a debug bounding box).

With `onUpdate`, the problem disappears rather than being worked around. An
update-bearing view becomes an ordinary `Container` carrying a hook, so it
composes into JSX like anything else, at any depth, inside a `<List>`, with no
ref, no hoisting, and no forwarding. The scheduler finds it by walking the tree
that JSX just built. This is the only benefit identified in this review that
has no alternative implementation: the others save discipline or lines, and
this one removes a structural limitation. If declarative scene construction is
a direction this repo intends to pursue, it materially strengthens the case.

**The testability pitch is weaker than the spike assumes.** The repo has zero
view tests, which looks like an opportunity. But
`docs/building-with-mvt/iterating-with-confidence/testing-views.md` already
demonstrates headless view testing by calling `view.onRender()` directly, and
then argues at length that scene-graph assertions are low-value compared to
visual snapshots (which need a renderer anyway). The plugin makes stepping a
multi-node scene headlessly convenient. It does not unlock something that was
blocked.

---

## Technical findings

### 1. Real bug: prototype accessor shadowing causes silent hook loss

`installMvtContainerMixin()` is lazy, running inside `createSceneScheduler`.
Any hook assigned *before* install creates an own data property on the instance
which permanently shadows the prototype accessor. From then on `hookChanged()`
never fires for that container.

Reproduced as a hard failure:

```ts
parent.onRefresh = () => {};            // pre-install: own data prop created
parent.onRefresh = undefined;
const s = createSceneScheduler(root);   // installs the mixin now
parent.onRefresh = () => order.push('parent');  // bypasses the accessor
s.refresh();                            // 'parent' is never called. No error.
```

The container simply never refreshes, with nothing to diagnose. This is the
exact construction order QUICK-START teaches in its own testing example: build
the scene, then call `createSceneScheduler`.

**Fix:** install the mixin at module load rather than lazily, and add a
dev-mode assertion that no instance carries an own `onUpdate` / `onRefresh`
property.

### 2. The benchmark harness is unsound

All benchmarks share one process, and whichever strategy runs **first** wins
the static-scene comparison by about 2.6x purely on JIT state. Reversing the
declaration order flips the winner exactly.

The README's published numbers do not reproduce. The same file, unmodified, on
this machine:

| scenario | README | observed |
| -------- | ------ | -------- |
| static, rebuild | 53,086 hz | 108,315 hz |
| static, incremental | 51,700 hz | 41,395 hz |

Read naively, that run says `rebuild` wins the static case by 2.6x, which is
the opposite of what the README concludes from its own data.

Re-run with each strategy in an isolated process:

| scenario | rebuild | incremental | |
| -------- | ------- | ----------- | - |
| static, 2000 containers | 108,408 hz | 109,405 hz | tie |
| 5 swaps/tick | 16,977 hz | 33,700 hz | incremental 1.99x |
| 100 swaps/tick | 10,307 hz | 16,302 hz | incremental 1.58x |

The README's *conclusions* survive this correction. Its *numbers* are off by
roughly 2x, and the harness will mislead whoever runs it next. Fix: one process
per strategy, or a warm-up phase that touches both before either is measured.

### 3. Performance is a non-issue, and that should be the headline

2000 hooked containers, both passes: about **9 microseconds per frame**.
Against a 16.7ms budget that is 0.05%. Even the losing strategy under heavy
churn costs about 97 microseconds.

So `rebuild` versus `incremental` is a question of engineering taste, not of
performance. **Ship `rebuild` only** (61 lines) and delete `incremental` (104
lines, plus tombstones, compaction, and two slot-index fields carried by every
Container in the process). The README half-concedes this ("rebuild is not the
liability it looked like on paper"). The measurement says go further.

### 4. The benchmarks omit the two baselines that matter

Neither benchmark answers the questions adoption actually turns on:

1. What does the plugin's dispatch cost compared to `onRender`, the incumbent
   in this repo?
2. What does the prototype patch cost an application that never uses it?

The "structural mutation, unmanaged tree" benchmark has no control to compare
against, so its number is uninterpretable on its own. Question 2 measures at
about 1% (see the table above). That is a good result and belongs in the
README.

### 5. `hookChanged` re-seats the entire subtree, undocumented

Assigning `onRefresh` to an attached root with 5 hooked descendants takes the
slot list from 5 entries to 11 (5 tombstones plus 6 live). Late hook assignment
is therefore O(subtree), and doing it per-frame thrashes compaction: 50
reassignments produced 25 compactions.

Correct behaviour, and deliberate, but it is a silent performance footgun that
is not written down anywhere.

### 6. Stats counters run unconditionally in both hot loops

`updateCalls++` and `refreshCalls++` execute per container, per frame, in
production builds, for a diagnostic that `mvt-types.ts` describes as "read by
the demo and the benchmark, not by game code."

### Verified as working correctly

Reparenting a container between two schedulers, re-scheduling a tree after
`scheduler.destroy()`, draining across deep spawn chains, skipping containers
detached mid-pass, and the documented direct-`children`-mutation bypass
(silently missed, exactly as stated). Test suite: 57 tests, 709ms, no renderer.
`tsc --noEmit` and `eslint` both clean.

---

## API review

### Good

- `onUpdate` / `onRefresh` mirror Pixi's `onRender` exactly right. The names
  need no explanation.
- `onUpdate(deltaMs)` rather than `onUpdate(ticker)` is the correct call, and
  the rationale in the README is sound.
- `createSceneScheduler(root)` working on a bare `Container` with no
  `Application`, ticker or renderer is the best single decision in the spike.
  The core/adapter split is clean and the adapter is genuinely thin.
- Not auto-subscribing to the ticker is right. It makes pause, slow motion and
  single-step one-liners instead of features.
- `SceneScheduler` is four members. Minimal.

### Cut or fix

- **`SchedulerStrategyKind` and `mvtStrategy` do not belong in the public API.**
  They expose an implementation detail as a user-facing option, for a choice
  users provably cannot perceive. Delete both.
- **`maxDrainRounds`** is a tuning knob for a failure mode. Make it a dev-mode
  constant.
- **`installMvtContainerMixin`** is exported but auto-called, and
  `mvtScenePlugin` is redundant alongside `installMvtScenePlugin`. The public
  surface could be three names: `createSceneScheduler`,
  `installMvtScenePlugin`, and the `SceneScheduler` type.
- **`SceneSchedulerStats`** has eight fields, four of them strategy-internal.
  Most disappear when the strategies collapse to one.
- **`app.scene`** is a land-grab on a very generic property name for a
  third-party plugin to take on `Application`. `app.mvt` is safer.

### Confusing or overcomplicated

- Two strategies where one would do, along with `SlotLists`, `ListStrategy`,
  tombstones, compaction, and `_mvtUpdateSlot` / `_mvtRefreshSlot` on every
  Container. The entire justification is a performance difference that does not
  register against a frame budget.
- The README is excellent as an engineering log and poor as a product page. It
  opens with retractions, spends its best prose on the decision that matters
  least, and buries the pitch. Promote QUICK-START to README, and move the
  current README to the design notes (now 002).

---

## Recommended sequence

1. **Eager mixin install** plus the dev-mode shadowing assertion. Correctness,
   and it is the only finding that can bite a user silently.
2. **Delete the `incremental` strategy** and the strategy option. Removes the
   largest chunk of surface and machinery for no measurable cost.
3. **Fix the benchmark harness.** Credibility, and it is the artifact a
   prospective adopter will run first.
4. **Restructure the docs.** QUICK-START becomes README, README becomes
   DESIGN-NOTES, and `onUpdate` leads.

For this repo specifically, migrate one game before touching the other 58
files. Scramble is the right candidate: it has the deepest `update` forwarding
chain, so it is where the discipline tax is most visible, and it will show
quickly whether the deleted plumbing feels like relief or like churn.
