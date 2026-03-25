# Signals

Signals are reactive primitives that automatically track dependencies and
propagate changes through a computation graph. They are the reactivity
foundation in SolidJS, Angular (since v16), Vue 3 (via `ref`/`computed`), and
the [TC39 Signals proposal](https://github.com/tc39/proposal-signals).

> **Navigation:** [Overview](./) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · Signals · [Watchers](watchers.md) ·
> [Comparison](comparison.md) · [Examples](examples.md)

---

## How It Works

A **signal** is a container for a value that notifies dependents when the value
changes. Reading a signal inside a **reactive context** (an effect or computed
derivation) automatically registers a dependency. When the signal's value
changes, all dependents are re-executed.

```
Write                           Read (tracked)
──────                          ──────────────
setScore(500)                   score()  ──► registers dependency
     │
     ▼
Dependency graph marks          Effect re-runs:
dependents as "dirty"           └─► scoreText.text = score()
```

This is a **push-pull hybrid** (see [Push vs Pull](push-vs-pull.md)):
notification of a change is _pushed_ through the dependency graph, but the
actual value is _pulled_ (re-read) when the dependent computation re-runs.

## Minimal Working Example

A score display for a Pac-Man-style game using SolidJS primitives:

```typescript
import { createSignal, createEffect, createMemo, createRoot, batch } from 'solid-js';

// --- Model ---

interface ScoreModel {
    readonly score: number;
    readonly lives: number;
    readonly highScoreReached: boolean;
    addPoints(points: number): void;
    loseLife(): void;
}

function createScoreModel(): ScoreModel {
    const [score, setScore] = createSignal(0);
    const [lives, setLives] = createSignal(3);
    const highScoreReached = createMemo(() => score() >= 10_000);

    return {
        get score() {
            return score();
        },
        get lives() {
            return lives();
        },
        get highScoreReached() {
            return highScoreReached();
        },
        addPoints(points: number) {
            setScore((prev) => prev + points);
        },
        loseLife() {
            setLives((prev) => prev - 1);
        },
    };
}

// --- View ---

function createHudView(model: ScoreModel): Container {
    const view = new Container();
    const scoreText = new Text({ text: '0', style: { fill: 'white', fontSize: 24 } });
    const livesText = new Text({ text: '♥♥♥', style: { fill: 'red', fontSize: 24 } });
    livesText.y = 30;
    view.addChild(scoreText, livesText);

    const dispose = createRoot((dispose) => {
        createEffect(() => {
            scoreText.text = String(model.score);
        });
        createEffect(() => {
            livesText.text = '♥'.repeat(model.lives);
        });
        createEffect(() => {
            if (model.highScoreReached) showExtraLifeAnimation();
        });
        return dispose;
    });

    // MUST dispose, or effects leak (see Drawback 2)
    view.on('destroyed', dispose);

    return view;
}

// --- Usage ---
const scoreModel = createScoreModel();
const hud = createHudView(scoreModel);
app.stage.addChild(hud);

scoreModel.addPoints(100); // scoreText updates automatically
scoreModel.addPoints(9900); // scoreText updates, PLUS highScoreReached effect fires
scoreModel.loseLife(); // livesText updates automatically

hud.destroy(); // Disposes reactive root, cleans up effects
```

Note: the effects discover their dependencies by tracking which signals are
read during execution - no manual wiring needed. However, disposal **is**
required. If `hud.destroy()` is never called, the effects remain in the
signal's subscriber list, preventing the view from being garbage-collected. This
cleanup obligation is easy to overlook and is discussed in
[Drawback 2](#2-effect-cleanup-and-ownership-must-be-managed).

## Key Concepts

### Signals: Readable/Writable State

```typescript
const [value, setValue] = createSignal(initialValue);

value(); // read - registers dependency if inside a tracking context
setValue(newVal); // write - marks all dependents as dirty
```

### Computed / Memo: Derived State

A value derived from other signals. Memoised - only recomputes when
dependencies change.

```typescript
const fullName = createMemo(() => `${firstName()} ${lastName()}`);
// fullName() returns cached value; recomputes only if firstName or lastName changed
```

### Effects: Side Effects

Code that runs when its dependencies change. Used to synchronise with external
systems (DOM, canvas, network).

```typescript
createEffect(() => {
    document.title = `Score: ${score()}`; // re-runs when score() changes
});
```

### Batching

Groups multiple signal writes so that dependents re-run only once with the
final state, avoiding intermediate ("glitch") values.

```typescript
batch(() => {
    setFirstName('Jane');
    setLastName('Smith');
});
// Effects see "Jane Smith", never "Jane Doe"
```

## Benefits

### 1. Automatic dependency tracking - no manual wiring

The developer writes `score()` inside a computation, and the system figures out
the dependency. There is no need to explicitly declare "this computation depends
on score." This reduces boilerplate and eliminates a class of bugs where a
dependency is forgotten.

```typescript
// The system knows this effect depends on score() and lives()
// simply because they are read during execution.
createEffect(() => {
    hudText.text = `Score: ${score()}  Lives: ${lives()}`;
});
```

### 2. Precise updates - only affected computations re-run

When `setScore(500)` is called, only computations that actually read `score()`
are re-executed. Computations that depend on `lives()` but not `score()` are
untouched. This is **granular reactivity** - the system does the minimum work
necessary.

In contrast, a poll-based watcher system evaluates _every_ watcher on every
tick, even if only one value changed.

### 3. Derived state is declarative and memoised

`createMemo` expresses derived state that recomputes lazily and caches the
result:

```typescript
const activeEnemies = createMemo(() => enemies().filter((e) => e.alive));
const enemyCount = createMemo(() => activeEnemies().length);
```

It is worth noting that a plain model (without signals) can also express
derived state declaratively - via getter properties that compute on read, or
internally-memoised values updated at mutation time. Signals' advantage is that
the memoisation is automatic and cross-cutting: a `createMemo` can derive from
any combination of signals, even across model boundaries, without the source
needing to pre-compute the result.

### 4. Works well with UI rendering models

Signals were designed for UI frameworks. They integrate naturally with component
rendering: a component reads signals, and re-renders when they change. This is
why SolidJS, Angular, Vue, and Preact all adopted them as core primitives.

### 5. Vendored reactivity with cross-framework aspirations

SolidJS, Angular, Vue, and Preact (with signals plugin) all provide signal
implementations that work within their respective ecosystems. SolidJS signals
are usable outside of SolidJS components, making them a candidate for shared
libraries.

The TC39 Signals proposal aims to standardise signals as a language primitive.
However, it is currently at **Stage 1** - meaning the committee has expressed
interest in exploring the problem space, not that a solution has been agreed
upon. Stage 1 proposals can change substantially, stall, or be withdrawn. It is
prudent to treat TC39 signals as aspirational, not imminent.

In practice, this means signal-based code today depends on a **vendored
runtime** (SolidJS, Angular, etc.). These runtimes are not mutually compatible:
SolidJS signals do not work inside Angular's change-detection cycle, and vice
versa. If your library uses SolidJS signals and a consumer uses Angular signals,
the two systems are separate dependency graphs that do not interoperate without
bridging.

**The honest assessment:** signals are composable _within_ a single vendored
ecosystem. Cross-framework portability is an aspiration that depends on TC39
progress that may or may not materialise. If avoiding vendored dependencies is a
project goal, signals are a harder choice than events or watchers (which require no
external runtime).

## Drawbacks

### 1. Dependency tracking has per-read overhead

Every signal read inside a reactive context performs bookkeeping: checking the
current tracking context, registering the dependency, and registering the
subscriber. Every signal write marks dependents dirty and schedules effect
re-execution. This overhead is measurable and, at game-typical scale, makes
signals significantly slower than watchers or events for per-tick state.

**What the bookkeeping involves:**

In a SolidJS-style implementation, each `score()` call inside a tracked
context does approximately:

1. **Read the current tracking context** - a global variable read.
2. **Add this signal to the context's dependency set** - typically a
   `Set.add()`.
3. **Add the context to the signal's subscriber set** - another `Set.add()`.
4. **Return the value.**

Each signal write (`setScore(v)`) performs:

1. **Compare new value to old** (`Object.is()`).
2. **Mark all subscribers as dirty.**
3. **At batch boundary:** re-execute effects in topological order, which
   involves re-running the dependency tracking for each effect body.

**Measured cost:** Benchmarks (`benchmarks/reactivity.bench.ts`) show signals
running 9-12x slower than watchers at game-typical scale (50-200 values), and
up to 60x slower in diamond dependency graphs. The overhead comes from the full
reactive pipeline: signal writes, dirty-marking, batch scheduling, effect
re-execution with dependency re-tracking, and subscription cleanup/recreation.

**GC pressure:** Steps 2 and 3 of the read path create Set entries on the heap.
When effects re-run, old subscriptions are cleaned up and new ones created. At
game-typical scale this is negligible, though it could become relevant at very
high binding counts or in extremely GC-sensitive scenarios.

**The practical takeaway:** at the scale of a typical game (50-200 reactive
bindings), signals cost roughly 10x more per tick than watchers. However, even
the signal overhead is small in absolute terms - well under 0.1% of the 16.6ms
frame budget. The performance difference is real but unlikely to be the deciding
factor. See [Comparison § Performance](comparison.md#performance-characteristics)
for further discussion and benchmarks.

### 2. Effect cleanup and ownership must be managed

Signals automate _what_ depends on _what_, but lifecycle management is still
required. Effects that reference signals must be disposed when they are no
longer needed, otherwise the signal's subscriber list retains a reference to the
effect's closure.

```typescript
// SolidJS: effects are scoped to an owner
const dispose = createRoot((dispose) => {
    createEffect(() => {
        ghostSprite.alpha = ghostModel.phase() === 'frightened' ? 0.5 : 1.0;
    });
    return dispose;
});

// When the ghost view is destroyed:
dispose(); // Must be called, or the effect leaks
```

A leaked effect does not throw an error, and its behaviour may not be
immediately observable - it runs on a detached view, updating a display object
that is no longer visible. This silent failure mode makes leaks hard to detect
during development and testing. They surface as gradual performance degradation
over time.

**A telling pattern:** the [Minimal Working Example](#minimal-working-example)
at the top of this page originally omitted disposal in its first draft - and
this is typical. Most signal tutorials, blog posts, and even library
documentation show the "happy path" (create signals, create effects, marvel at
automatic updates) without demonstrating cleanup. This subtly trains developers
to forget about it. In production code, the same pattern occurs: effects are
created with care, but disposal is an afterthought - if it's thought of at all.
Forgetting to dispose effects is one of the most common bugs in signal-based
applications.

**Comparison:** In a watcher/poll system, stopping the polling loop (e.g.
removing a view from the scene graph) is sufficient - there is nothing to
dispose. In an event system, each subscription must be individually removed. In
a signal system, the ownership scope must be explicitly closed.

### 3. Invisible reactivity boundary - signals vs plain functions

Signal accessors and ordinary functions look identical
at the call site. A developer reading or maintaining an effect must know _which_
functions are signals to understand what the effect reacts to.

```typescript
// Which of these is a signal? You can't tell from usage alone.
createEffect(() => {
    const speed = getBaseSpeed() * getDifficultyMultiplier();
    enemySprite.animationSpeed = speed;
});
```

If `getBaseSpeed` is a signal but `getDifficultyMultiplier` is a plain getter
on a config object, this effect reacts to base-speed changes but **silently
ignores difficulty changes**. The animation speed becomes stale whenever
difficulty changes without base speed also changing. This bug is invisible in
code review and may go unnoticed in testing if difficulty rarely changes
independently.

**This also means the source must pre-decide which values are signals.** A
signal system does not make _all_ state reactive by default - the source must
explicitly wrap values in signal containers. If the source exposes a value as a
plain property or getter (not a signal), consumers cannot react to it with
effects. This mirrors the [pre-declaration limitation of events](events.md#4-source-must-pre-declare-events-of-interest):
the consumer's reactive vocabulary is limited by the source's decisions about
what to make reactive.

**Importantly, some sources may not be yours to modify.** Third-party libraries,
platform APIs, and shared modules may expose plain properties or functions that
are not signal-wrapped. If you consume values from such sources inside an effect,
the effect will not react to their changes - and there is no way to make them
reactive without introducing a bridging layer (writing their values into your
own signals each tick), which negates the automatic-tracking benefit.

**This problem cannot be detected statically.** Even with branded signal types,
`createEffect` accepts a `() => void` callback, and TypeScript does not analyse
closure bodies to enforce constraints on what functions are called inside. The
distinction can only be maintained through naming conventions (e.g. all signals
are `value()` on a signal object) or careful manual review. Some signal
runtimes offer dev-mode warnings when an effect runs without tracking any
signals, but these only catch the case where _no_ dependencies are tracked -
not when _some_ dependencies are missed.

**Comparison:** In a watcher system, every watched value goes through the same
`watch(() => ...)` mechanism - there is no distinction between "reactive" and
"non-reactive" reads. Any readable state can be watched, regardless of how the
source implemented it. In an event system, the subscription is explicit
(`on('event', handler)`), making the reactive relationship visible.

### 4. Glitch prevention adds scheduling complexity

If multiple signals change, dependents must be executed in topological order to
avoid seeing inconsistent intermediate state. The signal runtime provides this
guarantee via a scheduler - but the scheduler's cost is proportional to the
dependency graph's depth and branching factor.

```typescript
const [a, setA] = createSignal(1);
const [b, setB] = createSignal(2);
const sum = createMemo(() => a() + b());

batch(() => {
    setA(10);
    setB(20);
});
// sum() must be 30, not 12 (a=10, b=2) or 21 (a=1, b=20).
// The scheduler ensures sum recomputes ONCE after both writes.
```

In simple cases, this overhead is small. In deep dependency graphs with diamond
patterns (A depends on B and C, both of which depend on D), the scheduler must
detect and resolve diamond dependencies to avoid double execution. This is
non-trivial work with worst-case cost proportional to the graph size.

**Comparison:** In a watcher/poll system, glitches are impossible by
construction - all writes happen before any reads. In an event system, glitches
manifest as cascade ordering issues (see [Events § Drawback 5](events.md#5-ordering-and-cascade-risks)).

### 5. Dynamic dependencies complicate reasoning

If an effect reads different signals depending on a condition, the dependency
graph changes on each execution:

```typescript
createEffect(() => {
    if (showDetails()) {
        console.log(details()); // dependency only when showDetails() is true
    }
});
```

The system must track which signals were actually read on each run, clean up
stale subscriptions, and add new ones. This is a source of runtime cost and
subtle bugs - if `showDetails()` returns `true` for one run and then `false`,
the effect stops tracking `details()`, which means a subsequent change to
`details()` will not trigger the effect even if `showDetails()` returns `true`
again before the effect has a chance to re-run for a different reason.

### 6. Difficult integration with external update systems

Signals assume they own the mutation/notification cycle. When an external system
(GSAP tweens, physics engines, WebSocket updates) is the source of truth, the
signal model requires bridging: writing external values into signals each frame
so that effects can react.

```typescript
// GSAP tweens a plain object. Assume GSAP's ticker has been replaced
// with Pixi's shared ticker (RAF-based), so both run in the same frame loop.
const tweenTarget = { y: 0 };
gsap.to(tweenTarget, { y: 100, duration: 1.0 });

// To make this reactive, you must sync the tween value to a signal:
const [posY, setPosY] = createSignal(0);

// In your tick callback (runs every frame via Pixi's shared ticker):
app.ticker.add(() => {
    setPosY(tweenTarget.y); // write every frame, even if unchanged
    // Effects that read posY() fire synchronously here
});

// Problem: you write to the signal 60 times/sec, each time triggering
// dependency checks and subscription bookkeeping, even though you could
// just read tweenTarget.y directly.
```

This bridging adds overhead and complexity that doesn't exist when the consumer
can simply read the external value directly (as in the watcher model).

See [Examples § GSAP Integration](examples.md#example-3-gsap-tween-integration)
for a detailed comparison of how each approach handles external tween sources.

### 7. Frequently-changing values negate signal benefits

In games and simulations, many values change on every tick - entity positions,
velocities, animation progress, timers. Making these values signals creates
a problematic trade-off:

- **If they are signals:** every write (60/sec per value) triggers dependency
  tracking, subscriber notification, and effect re-runs. The cost of the signal
  machinery is pure overhead - you would read these values every frame anyway.

- **If they are NOT signals:** they cannot trigger effects. Consumers must read
  them manually, bypassing the reactive system. This creates a split where some
  values are reactive and others are not - and the distinction is invisible at
  the call site (see [Drawback 3](#3-invisible-reactivity-boundary--signals-vs-plain-functions)).

The result is that signal-based game architectures often end up with a
two-tier system: signals for infrequent state changes (phase, level, lives),
and plain reads for per-frame values (positions, velocities). This reduces the
benefit of automatic dependency tracking - you end up manually managing the
per-frame reads anyway.

**Comparison:** In a watcher system, the idiom is natural: use watchers for
infrequent changes, and direct reads for per-frame values. There is no reactive
system to bypass - both are just property reads, with watchers adding a thin
change-detection layer for values that benefit from it.

## Design Considerations

### Aggregate Values (Arrays and Objects)

Dynamic collections are one of signals' more complex areas. The challenge is
tracking changes to collection _membership_ (items added/removed) and to
individual item _properties_ (positions, state).

| Strategy                                          | Trade-off                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Stores with deep tracking (SolidJS `createStore`) | Automatic granular reactivity; framework-specific; complex mental model |
| Signal holding an array + version counter         | Simple; loses granularity (entire array is "one signal")                |
| Map of signals (one signal per item property)     | Granular; verbose; lifecycle management for each signal                 |

**SolidJS stores** with `produce` provide the most ergonomic solution: mutations
to individual items trigger only effects that read those items. However, stores
are framework-specific, and outside of JSX rendering (e.g. Canvas/WebGL), the
developer must manually diff the collection to sync view objects.

**Version counters** (a signal that increments on each mutation) are a common
workaround that recreates event semantics: the effect detects the version change
and re-processes the collection. This works but means the signal system's
automatic dependency tracking is not providing its usual benefit.

For per-frame state within collection items (positions, velocities), writing to
signals 60 times per second per item incurs dependency-tracking overhead with
no benefit over direct reads. The typical pattern is signals for collection
membership plus direct reads for per-frame item state. See
[Examples § Asteroid Field](examples.md#example-4-asteroid-field-asteroids)
for this pattern in practice.

## When Signals Are a Good Fit

- **UI-driven web applications** where components render in response to state
  changes (forms, dashboards, data grids, SPAs). Signals were designed for this.
- **Derived state is central** - when many computations depend on combinations
  of other reactive values, signals' automatic memoisation avoids manual cache
  management.
- **Your framework already provides signals** - if you are using SolidJS,
  Angular 16+, or Vue 3, signals are the idiomatic reactivity model. Fighting
  them adds more complexity than using them.
- **Moderate binding counts with infrequent changes** - signals' zero-cost
  idle and precise updates are most advantageous when bindings are numerous but
  changes are sparse (a settings panel, a configuration form).

## When Signals Are a Poor Fit

- **Tick-based game loops** where many values are read every frame anyway -
  signals' dependency tracking overhead is pure waste when the answer to "when
  should I re-evaluate?" is always "every tick."
- **External tween/physics engines own the update** - bridging external values
  into signals adds friction without benefit.
- **High-frequency continuous values** (positions, velocities, opacity during
  animation) - writing to signals 60 times per second triggers 60 dependency
  checks per second per signal, with no advantage over reading a plain property.
- **Ephemeral view lifecycles** - games and simulations where views are created
  and destroyed rapidly. Each lifecycle boundary is a potential leak if
  ownership disposal is missed. (To be fair, this concern also applies to
  [event subscriptions](events.md#1-subscription-lifecycle-is-manual-and-error-prone).
  The degree to which it is a practical problem depends on team discipline, code
  review practices, and the availability of automated leak detection. Teams with
  strong lifecycle management practices may find the cleanup overhead acceptable
  for either approach.)
- **Avoiding vendored dependencies** - if the project cannot take a dependency
  on a signal runtime (SolidJS, Angular, etc.), events and watchers achieve reactivity with
  zero external code.

## Testing Considerations

Signals can be tested by writing to signals and asserting on effects or
computed values:

```typescript
const [score, setScore] = createSignal(0);
const isHighScore = createMemo(() => score() >= 10_000);

// Test derived value
setScore(5000);
assert.equal(isHighScore(), false);

setScore(10_000);
assert.equal(isHighScore(), true);
```

Testing effects requires running them inside a reactive root and disposing it
after the test:

```typescript
let captured = '';
const dispose = createRoot((dispose) => {
    createEffect(() => {
        captured = `Score: ${score()}`;
    });
    return dispose;
});

setScore(100);
assert.equal(captured, 'Score: 100');
dispose(); // clean up after test
```

This is more ceremony than testing a plain function or an event handler, and
the test must be aware of the signal runtime's synchronous/batching semantics.

---

> **Next:** [Watchers](watchers.md) - poll-based change detection for
> tick-driven architectures.
