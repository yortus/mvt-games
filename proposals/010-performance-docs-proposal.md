# Proposal: expand the performance documentation

> Performance claims in the docs are qualitative, and the one benchmark they
> cite has a measurement flaw. This proposal records a set of per-frame
> measurements taken with a sound method, explains that method and the pitfalls
> it avoids, checks the existing docs' claims against the results, and proposes
> the docs changes that should follow.

**Status:** proposed. The measurements are done; none of the docs changes are.

**Written:** 2026-09-24.

**Related:** [`docs/building-with-mvt/reacting-to-changes/why-polling.md`](../docs/building-with-mvt/reacting-to-changes/why-polling.md),
[`docs/building-with-mvt/avoiding-pitfalls/hot-paths.md`](../docs/building-with-mvt/avoiding-pitfalls/hot-paths.md),
[`benchmarks/reactivity-performance-investigation.md`](../benchmarks/reactivity-performance-investigation.md),
[`scripts/bench-scene-passes.ts`](../scripts/bench-scene-passes.ts),
[the `<List>` proposal](./004-list-proposal.md) section 7.1.

---

## 1. Summary

Three questions were measured, each on 1000 view elements:

1. **What does a polled binding cost?** Using this repo's JSX runtime
   (`src/pixi-jsx/`), and using hand-written refresh hooks, which is what a
   compiler such as Solid's would emit.
2. **How does polling compare with push-based reactivity** (Solid's signals and
   render effects) as the share of values changing per frame varies?
3. **Where does the runtime's time go?** Using CPU profiles.

Headline findings:

| Finding | Evidence |
| --- | --- |
| Polling costs about 4-8 ns per element per frame, plus Pixi's own work when a value changes | Section 5.2 |
| This JSX runtime costs 13-43% more than hand-written hooks: 1-3 ns per element, which is the getter calls themselves | Sections 5.1, 5.2 |
| A static prop costs nothing per frame; each getter costs about 1.4 ns in the runtime and 0.65 ns hand-written | Section 5.2 |
| Push wins by 10-70x when 1% or less of values change, and loses by 3.9-5.6x when all of them change | Section 5.3 |
| The crossover is at about 11-16% of values changing per frame | Section 5.3 |
| Designs benchmarked side by side in one Vitest process gave ratios and overheads (2.3-2.7x, a phantom 5.6 ns per element) that separate bundled processes did not reproduce (1.8x, 0.5 ns) | Section 4.1 |

The findings mostly **support** what `why-polling.md` says, and give it
numbers it currently lacks. They also show that the benchmark it cites, and the
investigation built on it, used a method that cannot be trusted for
comparisons (section 4.1).

**What this proposal asks for** (section 7):

- A new page on measuring performance, covering the method and its pitfalls.
- A "what things cost" section in `hot-paths.md`.
- Measured numbers in `why-polling.md`, in place of its qualitative cost claims.
- The existing reactivity benchmarks reworked to run one design per process,
  and the investigation re-run.

---

## 2. Motivation

**The docs make performance claims without numbers.** `why-polling.md` says
polling's idle cost is "a negligible part of the frame budget" at "game-typical
scale", that signals are "wasteful" for continuous state, and that per-frame
comparison cost "grows linearly" at extreme scale. All plausible, none
quantified. `hot-paths.md` gives allocation guidance with no costs attached.

**The one cited benchmark is methodologically unsound.** `why-polling.md` ends
with an empirical note pointing at `benchmarks/reactivity-simple.bench.ts`.
That suite, like `reactivity-detailed.bench.ts`, runs its designs side by side
in one Vitest process. Section 4.1 shows that this setup, during this work,
produced ratios of 2.3-2.7x where separate processes gave 1.8x, and a cost that
does not exist. The direction of its conclusions agrees with the measurements here, but
its numbers should not be relied on.

**Its supporting references are also stale.** The investigation says to run
the suite with `npm run bench`, which now runs `scripts/bench-scene-passes.ts`
instead. It names `reactivity.bench.ts`, which no longer exists (the closest
file is `reactivity-detailed.bench.ts`), and the suite header points at
`docs/reactivity-guide/comparison.md`, which no longer exists.

**Nothing documents how to measure.** The only guidance is a comment in
`scripts/bench-scene-passes.ts`, which is exactly the lesson section 4.1
relearned the hard way.

---

## 3. Method

### 3.1 Environment

| | |
| --- | --- |
| Machine | Intel Core Ultra 9 185H, Windows 11 Home |
| Runtime | Node.js v22.11.0 (V8) |
| Libraries | pixi.js 8.16.0, solid-js 1.9.15 (browser build, `dist/solid.js`) |
| Bundler | esbuild 0.27.3 |

Only V8 under Node was measured. Browsers were not, and nor were other engines
(section 8).

### 3.2 Harness

The harness is in Appendix A. Each run measures one **configuration**, a
combination of:

- **Design**, how the view is kept in sync with the model:
  - `mutate-only`: the model writes alone, with no view. Shows the model's
    share of the cost.
  - `pull-runtime`: elements built with this repo's `jsx()`, refreshed by
    `refreshScene`. The runtime version measured is the cached-factory design
    described in section 5.1.
  - `pull-compiled`: hand-written `onRefresh` hooks that read model fields
    directly, refreshed by `refreshScene`. This is what a compiler would emit.
  - `push-solid`: model fields are Solid signals, and each element has one
    `createRenderEffect` reading its signals, which mirrors how Solid's compiler
    groups an element's dynamic attributes. Each frame's writes are wrapped in
    `batch`.
- **Shape**, the props on each element:
  - `all-dynamic`: `x`, `y` and `alpha` are all getters.
  - `one-dynamic`: `x` is a getter; `y` and `alpha` are static.
- **Change rate**: 0, 1, 10, 50 or 100% of the 1000 elements have all three of
  their model values changed each frame (`x` and `y` increment, `alpha`
  alternates between 1 and 0.5).

Each run warms up for 3000 frames, then times 15 batches of 1000 frames and
takes the median batch. **Each configuration runs in its own process, three
times**; results report the median of the three, with the range.

**What a frame's time includes:** the model writes plus whatever keeps the view
in sync. For the pull designs, that is the writes plus `refreshScene`. For
push, it is the signal writes, which is where push does its work.

**What it excludes:** rendering (Pixi's transform updates and batching, which
are the same in every design), construction cost, memory, and garbage
collection outside the timed window.

### 3.3 Profiling

CPU profiles used `node --cpu-prof --cpu-prof-interval 25` on the bundled
harness, summarised as self time per function. Because V8 inlines the pass, the
hooks and the getters into one another, attribution also used
`--max-inlined-bytecode-size=0`. That slows everything down, so only relative
shares are meaningful. Deoptimisations were counted with `--trace-deopt`.

---

## 4. Measurement pitfalls

Each of these produced a wrong conclusion during this work before it was
caught. They are what the proposed "Measuring performance" page should teach.

### 4.1 Several designs in one process

V8's inline caches and optimisation decisions are shared across code in a
process. Designs timed side by side share them, and whichever runs first
shapes how the rest are compiled. `scripts/bench-scene-passes.ts` already
warns that the first arm "wins by more than 2x whichever order they are written
in".

Measured here, the same designs (the previous JSX runtime design from section
5.1, and hand-written hooks; 1000 elements, 3 getters, no change) gave:

| | In one Vitest process | One design per process, bundled |
| --- | --- | --- |
| Previous JSX runtime | 26.5-29.2 µs | 9.75-10.11 µs |
| Hand-written hooks | 10.9-11.6 µs | 5.55-5.70 µs |
| Ratio | 2.3-2.7x | about 1.8x |
| Scene pass overhead over a plain loop | about 5.6 ns per element | about 0.5 ns per element |

The in-process setup also made a refresh-only copy of the pass loop measure
slower than the shared one (14.7 against 9.9 µs), which led to rejecting an
idea on false evidence. It also suggested that static props saved nothing,
which the per-process numbers contradict (section 5.2).

**A confound.** The Vitest runs differ from the per-process runs in two ways at
once: designs shared a process, and the code ran unbundled under Vitest's
transform, which alone roughly doubles absolute times. These measurements
cannot say how much of the distorted *ratios* each cause contributed. The
evidence that sharing a process distorts comparisons on its own is the
existing harness's comment above, from earlier work on the scene passes.
Avoiding both is cheap, so the rule does not depend on untangling them.

**Rule:** one design per process, always.

### 4.2 Running TypeScript through a loader

Under `tsx`, 12 identical runs of one configuration ranged from 8.2 to 18.0 µs.
`tsx` moves module loading into a worker thread, and its activity shows up in
the timings and in profiles, where it accounted for about 40% of samples.
Bundled to plain JavaScript with esbuild, 8 runs ranged from 7.80 to 8.05 µs.

**Rule:** bundle first, then run and profile plain JavaScript.

### 4.3 Solid resolving to its server build

Under Node, `solid-js` resolves to its server build, in which effects never
run. Push then looks free. The existing investigation found this too, and
`vite.config.ts` aliases the browser build for tests. The harness imports
`dist/solid.js` by path.

**Rule:** check that the reactive system under test actually reacts.

### 4.4 Dividing by the wrong unit

An early result was reported as "ns per binding" by dividing a frame's time by
the number of bindings. The per-process numbers show the cost has a per-element
part and a per-binding part (section 5.2). Dividing by one unit hid the other.

**Rule:** vary one dimension at a time (bindings per element, element count)
before choosing the unit.

### 4.5 Reading profiles without accounting for inlining

With inlining on, almost all samples land on the outermost frame function, so
a profile says little about where time goes inside it. Disabling inlining
restores attribution at the cost of absolute speed.

**Rule:** use inlining-off profiles for relative shares only.

---

## 5. Findings

### 5.1 The runtime's refresh code, and where its time goes

The runtime generates a refresh hook for each element from cached generated
code. Two designs were compared, on 1000 elements with three getters, no
change, one design per process, bundled, with 3-4 runs each:

| Design | Per frame |
| --- | --- |
| Previous: each hook calls a shared generated function, which calls getters through an array | 9.75-10.11 µs |
| **Current: a cached generated factory returns each element's hook, which calls its captured getters directly** | 7.78-7.83 µs |
| Hand-written hooks, through `refreshScene` | 5.55-5.70 µs |
| Hand-written hooks, plain loop without `refreshScene` | 5.15-5.23 µs |

- The factory design is 21% faster and halves the gap to hand-written hooks,
  from about 4.3 to about 2.2 ns per element. It is now in `jsx-runtime.ts`.
- `refreshScene` costs about 0.5 ns per element over a plain loop.
- No deoptimisations occur after warm-up.

With inlining disabled, the profiles attribute:

| Share of samples | JSX runtime | Hand-written |
| --- | --- | --- |
| The element's hook | 24.0% | 27.5% |
| The three getters (`() => m.x` and so on) | 20.6% | none |
| The pass (`invokeSubtreeMethods`, `refreshScene`, the `onRefresh` accessor) | 17.3% plus accessor | 27.6% |
| Pixi's setters (`x`, `y`, `alpha`) | most of the rest | most of the rest |

The runtime's remaining cost over hand-written hooks is the getter calls. A
runtime cannot remove them, because getters are all it receives.

### 5.2 Polling: this runtime against hand-written hooks

Median µs per frame for 1000 elements, with the range over three processes.
1% change is omitted from this table; it is within noise of 0% (full results
in Appendix B).

| Props per element | Change | Runtime | Hand-written | Ratio | Gap per element |
| --- | --- | --- | --- | --- | --- |
| 3 getters | 0% | 7.86 [7.80-8.03] | 5.49 [5.28-5.91] | 1.43 | 2.4 ns |
| 3 getters | 10% | 8.48 [8.30-8.58] | 6.12 [6.03-6.28] | 1.39 | 2.4 ns |
| 3 getters | 50% | 10.74 [10.69-11.26] | 8.34 [7.82-8.51] | 1.29 | 2.4 ns |
| 3 getters | 100% | 13.38 [13.33-13.40] | 10.71 [9.86-12.81] | 1.25 | 2.7 ns |
| 1 getter, 2 static | 0% | 5.07 [4.91-5.10] | 4.20 [4.17-4.20] | 1.21 | 0.9 ns |
| 1 getter, 2 static | 10% | 5.31 [5.04-5.36] | 4.57 [4.55-4.60] | 1.16 | 0.7 ns |
| 1 getter, 2 static | 50% | 6.64 [6.58-6.88] | 5.81 [5.74-5.87] | 1.14 | 0.8 ns |
| 1 getter, 2 static | 100% | 8.17 [8.02-8.17] | 7.20 [7.05-7.31] | 1.13 | 1.0 ns |

- **Polling costs about 4-8 ns per element per frame** when nothing changes,
  depending on how many getters an element has.
- **Static props cost nothing per frame.** Each getter adds about 1.4 ns in the
  runtime and 0.65 ns hand-written. Making two of three props static cut the
  runtime's frame time by about 35%.
- **Changes cost extra, the same in both.** From 0% to 100% change, polling
  costs rise about 70%, mostly Pixi's setters doing real work (they return
  early when a value is unchanged). The model's own writes are negligible:
  `mutate-only` costs at most 1.5 µs at 100%.
- **The gap is small in absolute terms.** At 10,000 elements with three
  getters, the runtime costs about 24 µs more per frame than hand-written
  hooks: about 0.14% of a 16.7 ms frame.

### 5.3 Polling against push

| Props per element | Change | Pull, runtime | Pull, hand-written | Push (Solid) |
| --- | --- | --- | --- | --- |
| 3 getters | 0% | 7.86 | 5.49 | **0.08** |
| 3 getters | 1% | 8.14 | 5.78 | **0.55** |
| 3 getters | 10% | 8.48 | 6.12 | **5.34** |
| 3 getters | 50% | 10.74 | **8.34** | 28.05 |
| 3 getters | 100% | 13.38 | **10.71** | 52.42 |
| 1 getter, 2 static | 0% | 5.07 | 4.20 | **0.08** |
| 1 getter, 2 static | 1% | 5.02 | 4.27 | **0.47** |
| 1 getter, 2 static | 10% | 5.31 | 4.57 | **3.80** |
| 1 getter, 2 static | 50% | **6.64** | **5.81** | 20.48 |
| 1 getter, 2 static | 100% | **8.17** | **7.20** | 40.34 |

- **Polling costs roughly the same whatever changes.** Push costs about 53 ns
  per changed element with three signals read, about 40 ns with one, and almost
  nothing otherwise.
- **Crossover:** push stops winning at about 11% of values changing per frame
  against hand-written polling, and about 13-16% against this runtime.
- **At 1% change or less, push is 10-70x cheaper.** This is the UI case: most of
  the screen is idle most of the time.
- **At 100% change, push is 3.9-5.6x more expensive.** This is the game case:
  moving entities change every frame.
- **Push also changes the model.** Its fields become signals, so the model is
  no longer plain state. That is a design cost the timings do not show.

### 5.4 Results that need re-measuring

These were measured before the pitfalls in section 4 were understood, with
several designs in one Vitest process. They may be wrong and should be
re-measured before anything else cites them:

- `array.at(i)` against `array[i]` (0.76 against 0.77 ns per element), cited
  in 004 section 4.7.
- The refresh-function cache's effect under churn (412 to 257 µs per frame) and
  on construction (1.51 to 1.34 µs), cited in 004 section 7.1.
- Every number in `benchmarks/reactivity-performance-investigation.md`.

---

## 6. How the findings bear on the current docs

| Current claim (`why-polling.md`) | Verdict |
| --- | --- |
| Polling's idle cost is negligible at game-typical scale | **Supported.** About 4-8 µs per frame per 1000 polled elements, under 0.05% of a frame |
| Events and signals cost nothing when idle | **Supported.** Push costs 0.08 µs per frame when nothing changes |
| For continuously changing values, polling is cheaper than signals | **Supported, and quantified.** 3.9-5.6x cheaper at 100% change |
| Per-frame comparison cost grows linearly at extreme scale | **Supported.** About 4-8 ns per element per frame |
| Its empirical note: benchmarks confirm watcher overhead is negligible | **Direction agrees, method unsound** (section 4.1). Replace with these measurements |

`hot-paths.md` makes no performance claims with numbers. Its allocation
guidance was not measured here, so this proposal neither supports nor
challenges it.

---

## 7. Proposed docs changes

### 7.1 New page: `docs/building-with-mvt/avoiding-pitfalls/measuring-performance.md`

How to benchmark MVT code without fooling yourself. Contents:

- One design per process, and why (section 4.1, with the before-and-after table
  as the worked example).
- Bundle to plain JavaScript before timing or profiling (section 4.2).
- Warm up, time in batches, report the median and the range, repeat across
  processes.
- Check that push-based libraries actually react under Node (section 4.3).
- Vary one dimension at a time before choosing a unit (section 4.4).
- Profiles: inlining hides attribution; use `--max-inlined-bytecode-size=0`
  for relative shares only (section 4.5).
- Measure the frame as a whole, including model writes, and say what is
  excluded (rendering, construction, memory).

It sits beside `hot-paths.md`, which tells you what to avoid; this page tells
you how to find out.

### 7.2 `hot-paths.md`: add "What things cost"

A short section with the measured costs, stated with their conditions (1000
elements, V8, Node 22, this machine), and a link to the measuring page:

- A polled element: about 4-8 ns per frame, most of it the setters and the pass.
- Each extra getter: about 0.65-1.4 ns. A static prop: nothing per frame.
- A changed value: the setter's real work, the same whatever keeps the view in
  sync.
- A frame-budget table: 1,000 / 10,000 / 100,000 polled elements as a share of
  16.7 ms.

The section should close with the practical rule the numbers support: at game
scale, allocation and algorithmic choices matter far more than binding
overhead.

### 7.3 `why-polling.md`: numbers in place of adjectives

- **Limitations and Tradeoffs:** replace "negligible", "linear" and "zero when
  idle" with the section 5.3 numbers, and add the crossover (about 11-16% of
  values changing per frame).
- **A new subsection, "When push wins":** state plainly that for UIs that are
  mostly idle, push is 10-70x cheaper, which is why UI frameworks use it, and
  why games with continuously moving entities do not.
- **The empirical note:** point at the new measurements and the measuring page
  instead of the in-process benchmark.

### 7.4 The benchmarks themselves

- Rework `benchmarks/*.bench.ts` to run one design per process. Following the
  shape of `scripts/bench-scene-passes.ts` keeps the repo consistent.
- Commit the section 3.2 harness as `scripts/bench-reactivity.ts`, with an
  `npm run bench:reactivity` script, so the tables in this proposal can be
  reproduced. It can import the repo's own `solid-js` (1.9.11) browser build
  by path, rather than the scratch copy used here.
- Re-run `reactivity-performance-investigation.md`'s scenarios under the new
  harness, correct its numbers, and fix its stale references.

### 7.5 What stays out of `docs/`

The JSX-runtime-specific numbers (sections 5.1 and the runtime column of 5.2)
belong in `src/pixi-jsx/` and the `<List>` proposal until the JSX runtime
graduates, consistent with 004 section 9 step 8. The pull-against-push and
per-element costs are general, and belong in `docs/`.

---

## 8. Open questions

1. **Browsers.** Everything here is V8 under Node on one machine. Should the
   docs numbers be re-measured in Chrome, Firefox and Safari before
   publishing, or published with that caveat? Recommend: publish with the
   caveat, and state the ratios rather than implying the absolute numbers
   transfer.
2. **Rendering.** Excluded throughout. When values change, Pixi's render-side
   work is likely larger than anything measured here, and would shrink every
   ratio above. Worth one measurement before the docs claim "at game scale,
   binding overhead does not matter".
3. **Push's construction and memory cost.** A signal per field and an effect
   per element were not measured. They matter for pools and churning lists.
4. **Regression tracking.** Should any of these benchmarks run in CI? Timing
   noise on shared runners makes that hard; recommend not, and treat the
   harness as an on-demand tool.
5. **A change-gate for idle subtrees.** The one case where push beats pull by
   an order of magnitude is a mostly idle subtree (section 5.3). A prop such as
   `<container refreshWhen={() => model.version}>`, returning
   `SKIP_DESCENDANTS` while the value is unchanged, would make an idle subtree
   cost one getter call per frame. Unmeasured. Its risk is the one the old
   reconciling `<List>`'s `version` prop had: a model that forgets to bump its
   version silently freezes the view. Worth trying only if an idle-heavy UI
   appears.
6. **The JSX runtime's remaining per-element cost is the getter calls.** After
   the cached-factory change (section 5.1) the profile attributes the
   remaining ~2 ns per element over hand-written hooks to calling getters,
   which a runtime cannot avoid. No further optimisation of the runtime's
   refresh path is expected to pay off.

---

## 9. Implementation steps

1. Commit the harness (7.4, second bullet) and re-run it to confirm the tables
   reproduce on the committed version.
2. Re-measure the section 5.4 results and correct 004 where they differ.
3. Write `measuring-performance.md` (7.1).
4. Add "What things cost" to `hot-paths.md` (7.2).
5. Update `why-polling.md` (7.3).
6. Rework the existing benchmarks and investigation (7.4).
7. Update `docs/ai-agents/skill-mvt-view.md` and `AGENTS.md` if the hot-path
   rules change as a result. Nothing in the findings requires it today.

---

## Appendix A: Harness

As run, except that the Solid import pointed at a scratch install of 1.9.15.
Bundle with `npx esbuild <file> --bundle --platform=node --format=esm
--outfile=bench.mjs`, then run `node bench.mjs <design> <shape> <pct>` once
per configuration.

```ts
import { Container } from 'pixi.js';
import { refreshScene } from '../src/pixi-mvt';
import { jsx } from '../src/pixi-jsx';
// Solid's browser build by path: Node would otherwise resolve the server build
import * as S from '../node_modules/solid-js/dist/solid.js';

const [design, shape, pctArg] = process.argv.slice(2);
const N = 1000;
const changing = (N * Number(pctArg)) / 100;
const allDynamic = shape === 'all-dynamic';

interface M { x: number; y: number; a: number }

function time(frame: () => void): number {
    for (let f = 0; f < 3000; f++) frame();
    const runs: number[] = [];
    for (let r = 0; r < 15; r++) {
        const t = performance.now();
        for (let f = 0; f < 1000; f++) frame();
        runs.push((performance.now() - t) / 1000);
    }
    runs.sort((a, b) => a - b);
    return runs[7] * 1000;
}

let result = 0;
if (design === 'push-solid') {
    S.createRoot((dispose: () => void) => {
        type Sig = [() => number, (v: number) => void];
        const sx: Sig[] = [];
        const sy: Sig[] = [];
        const sa: Sig[] = [];
        for (let i = 0; i < N; i++) {
            sx.push(S.createSignal(i));
            sy.push(S.createSignal(i));
            sa.push(S.createSignal(1));
            const el = new Container();
            const [x] = sx[i];
            const [y] = sy[i];
            const [a] = sa[i];
            // One render effect per element, as Solid's compiler emits
            if (allDynamic) S.createRenderEffect(() => { el.x = x(); el.y = y(); el.alpha = a(); });
            else { el.y = 5; el.alpha = 0.5; S.createRenderEffect(() => { el.x = x(); }); }
        }
        let tick = 0;
        result = time(() => S.batch(() => {
            tick++;
            const av = (tick & 1) ? 0.5 : 1;
            for (let i = 0; i < changing; i++) {
                sx[i][1](sx[i][0]() + 1);
                sy[i][1](sy[i][0]() + 1);
                sa[i][1](av);
            }
        }));
        dispose();
    });
}
else {
    const models: M[] = Array.from({ length: N }, (_, i) => ({ x: i, y: i, a: 1 }));
    let tick = 0;
    const mutate = () => {
        tick++;
        const a = (tick & 1) ? 0.5 : 1;
        for (let i = 0; i < changing; i++) {
            const m = models[i];
            m.x += 1;
            m.y += 1;
            m.a = a;
        }
    };
    const root = new Container();
    for (let i = 0; i < N; i++) {
        const m = models[i];
        if (design === 'pull-runtime') {
            root.addChild(allDynamic
                ? jsx('container', { x: () => m.x, y: () => m.y, alpha: () => m.a })
                : jsx('container', { x: () => m.x, y: 5, alpha: 0.5 }));
        }
        else if (design === 'pull-compiled') {
            const el = new Container();
            if (allDynamic) el.onRefresh = () => { el.x = m.x; el.y = m.y; el.alpha = m.a; };
            else { el.y = 5; el.alpha = 0.5; el.onRefresh = () => { el.x = m.x; }; }
            root.addChild(el);
        }
    }
    result = design === 'mutate-only' ? time(mutate) : time(() => { mutate(); refreshScene(root); });
}
console.log(result.toFixed(2));
```

The section 5.1 comparison used a variant of this harness with a
`pass-jsx-old` design, built from a temporary copy of `jsx-runtime.ts` that
restored the previous shared-function refresh. Neither is committed.

## Appendix B: Full results

Median µs per frame over three processes, with the range. 1000 elements.

| Shape | Change | mutate-only | pull-runtime | pull-compiled | push-solid |
| --- | --- | --- | --- | --- | --- |
| all-dynamic | 0% | 0.01 [0.01-0.01] | 7.86 [7.80-8.03] | 5.49 [5.28-5.91] | 0.08 [0.08-0.09] |
| all-dynamic | 1% | 0.02 [0.02-0.03] | 8.14 [7.89-8.23] | 5.78 [5.67-5.89] | 0.55 [0.55-0.61] |
| all-dynamic | 10% | 0.16 [0.16-0.19] | 8.48 [8.30-8.58] | 6.12 [6.03-6.28] | 5.34 [5.20-5.73] |
| all-dynamic | 50% | 0.76 [0.76-0.76] | 10.74 [10.69-11.26] | 8.34 [7.82-8.51] | 28.05 [25.63-28.47] |
| all-dynamic | 100% | 1.51 [1.49-1.70] | 13.38 [13.33-13.40] | 10.71 [9.86-12.81] | 52.42 [52.16-55.31] |
| one-dynamic | 0% | 0.01 [0.01-0.01] | 5.07 [4.91-5.10] | 4.20 [4.17-4.20] | 0.08 [0.08-0.08] |
| one-dynamic | 1% | 0.02 [0.02-0.02] | 5.02 [4.93-5.10] | 4.27 [4.27-4.29] | 0.47 [0.47-0.51] |
| one-dynamic | 10% | 0.16 [0.16-0.16] | 5.31 [5.04-5.36] | 4.57 [4.55-4.60] | 3.80 [3.75-3.86] |
| one-dynamic | 50% | 0.74 [0.74-0.76] | 6.64 [6.58-6.88] | 5.81 [5.74-5.87] | 20.48 [19.46-20.57] |
| one-dynamic | 100% | 1.52 [1.49-1.53] | 8.17 [8.02-8.17] | 7.20 [7.05-7.31] | 40.34 [39.24-42.29] |
