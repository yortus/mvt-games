# Signals

Signals are reactive primitives that automatically track dependencies and
propagate changes through a computation graph. They are the reactivity
foundation in SolidJS, Angular (since v16), Vue 3 (via `ref`/`computed`), and
the [TC39 Signals proposal](https://github.com/tc39/proposal-signals).

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · Signals · [Watchers](watchers.md) ·
> [Comparison](comparison.md) · [Examples](examples.md)

---

## How It Works

A **signal** is a container for a value that notifies dependents when the value
changes. Reading a signal inside a **reactive context** (an effect or computed
derivation) automatically registers a dependency. When the signal's value
changes, all dependents are re-executed.

```
 Write                          Read (tracked)
───────                         ──────────────
setScore(500)                   score()  ──► registers dependency
     │
     ▼
Dependency graph marks          Effect re-runs:
dependents as "dirty"           └─► scoreText.text = score()
```

This is a **push-pull hybrid** (see [Push vs Pull](push-vs-pull.md)):
notification of a change is *pushed* through the dependency graph, but the
actual value is *pulled* (re-read) when the dependent computation re-runs.

## Minimal Working Example

A score system for a Pac-Man-style game using SolidJS primitives:

```typescript
import { createSignal, createEffect, createMemo, batch } from 'solid-js';

// --- Signals (model layer) ---

const [score, setScore] = createSignal(0);
const [lives, setLives] = createSignal(3);

// Derived signal — recomputes only when score() changes
const highScoreReached = createMemo(() => score() >= 10_000);

function addPoints(points: number): void {
    setScore(prev => prev + points);
}

function loseLife(): void {
    setLives(prev => prev - 1);
}

// --- Effects (view layer) ---

const scoreText = new Text({ text: '0', style: { fill: 'white', fontSize: 24 } });
const livesText = new Text({ text: '♥♥♥', style: { fill: 'red', fontSize: 24 } });

// These effects run automatically when their dependencies change
createEffect(() => {
    scoreText.text = String(score());
});

createEffect(() => {
    livesText.text = '♥'.repeat(lives());
});

createEffect(() => {
    if (highScoreReached()) {
        showExtraLifeAnimation();  // runs once when score crosses 10,000
    }
});

// --- Usage ---
addPoints(100);   // scoreText updates automatically
addPoints(9900);  // scoreText updates, PLUS highScoreReached effect fires
loseLife();        // livesText updates automatically
```

Note: no subscriptions, no cleanup calls, no manual wiring. The effects
discover their dependencies by tracking which signals are read during execution.

## Key Concepts

### Signals: Readable/Writable State

```typescript
const [value, setValue] = createSignal(initialValue);

value();          // read — registers dependency if inside a tracking context
setValue(newVal);  // write — marks all dependents as dirty
```

### Computed / Memo: Derived State

A value derived from other signals. Memoised — only recomputes when
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

### 1. Automatic dependency tracking — no manual wiring

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

### 2. Precise updates — only affected computations re-run

When `setScore(500)` is called, only computations that actually read `score()`
are re-executed. Computations that depend on `lives()` but not `score()` are
untouched. This is **granular reactivity** — the system does the minimum work
necessary.

In contrast, a poll-based watcher system evaluates *every* watcher on every
tick, even if only one value changed.

### 3. Derived state is declarative and memoised

`createMemo` expresses derived state that recomputes lazily and caches the
result:

```typescript
const activeEnemies = createMemo(() => enemies().filter(e => e.alive));
const enemyCount = createMemo(() => activeEnemies().length);
```

Without signals, maintaining derived state requires either per-tick
recomputation (wasteful) or manual cache invalidation at every mutation site
(error-prone).

### 4. Composable and framework-independent (with caveats)

The TC39 Signals proposal aims to standardise signals as a language primitive,
independent of any framework. SolidJS signals are already usable outside of
SolidJS components. This makes signals a candidate for shared libraries and
framework-agnostic architecture — although in practice, the effect scheduling
and ownership models still vary between frameworks.

### 5. Works well with UI rendering models

Signals were designed for UI frameworks. They integrate naturally with component
rendering: a component reads signals, and re-renders when they change. This is
why SolidJS, Angular, Vue, and Preact (with signals plugin) all adopted them
as core primitives.

## Drawbacks

### 1. Dependency tracking has per-read overhead

Every signal read inside a reactive context performs bookkeeping: checking the
tracking context, registering the dependency, and registering the subscriber.
This overhead is typically small per read, but it adds up.

**Concrete cost analysis:**

In a SolidJS-style implementation, each `score()` call inside a tracked
context does approximately:

1. Read the current tracking context (global variable)
2. If tracking, add this signal to the context's dependency list
3. Add the context to the signal's subscriber list
4. Return the value

For N signal reads per frame, that is ~3N bookkeeping operations in addition to
the N value reads. In contrast, reading a plain property (`model.score`) has
zero overhead beyond the property access itself.

For a UI app re-rendering components on user interaction, this overhead is
negligible. For a game loop reading 100+ values 60 times per second, it is
measurable — though whether it is *material* depends on the total frame budget.
See [Comparison § Performance](comparison.md#performance-characteristics) for
benchmark guidance.

### 2. Effect cleanup and ownership must be managed

Signals automate *what* depends on *what*, but lifecycle management is still
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
dispose();  // Must be called, or the effect leaks
```

A leaked effect does not throw an error, and its behaviour may not be
immediately observable — it runs on a detached view, updating a display object
that is no longer visible. This silent failure mode makes leaks hard to detect
during development and testing. They surface as gradual performance degradation
over time.

**Comparison:** In a watcher/poll system, stopping the polling loop (e.g.
removing a view from the scene graph) is sufficient — there is nothing to
dispose. In an event system, each subscription must be individually removed. In
a signal system, the ownership scope must be explicitly closed.

### 3. Invisible reactivity boundary — signals vs plain functions

A critical pitfall: signal accessors and ordinary functions look identical
at the call site. A developer reading or maintaining an effect must know *which*
functions are signals to understand what the effect reacts to.

```typescript
// Which of these is a signal? You can't tell from usage alone.
createEffect(() => {
    if (getPhase() === 'spinning') {
        playSound(getVolume());
    }
});
```

If `getPhase` is a signal but `getVolume` is a plain function, this effect
reacts to phase changes but **never reacts to volume changes**. The code reads
as if it should react to both. This bug is invisible in code review without
knowledge of each function's implementation.

**This cannot be solved at the TypeScript type level.** Even with branded signal
types, `createEffect` accepts a `() => void` callback, and TypeScript does not
analyse closure bodies to enforce constraints on what functions are called
inside. The distinction can only be maintained through naming conventions (e.g.
all signals are `value()` on a signal object) or runtime dev-mode warnings.

**Comparison:** In a watcher system, every watched value goes through the same
`watch(() => ...)` mechanism — there is no distinction between "reactive" and
"non-reactive" reads. In an event system, the subscription is explicit
(`on('event', handler)`), making the reactive relationship visible.

### 4. Glitch prevention adds scheduling complexity

If multiple signals change, dependents must be executed in topological order to
avoid seeing inconsistent intermediate state. The signal runtime provides this
guarantee via a scheduler — but the scheduler's cost is proportional to the
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
construction — all writes happen before any reads. In an event system, glitches
manifest as cascade ordering issues (see [Events § Drawback 4](events.md#4-ordering-and-cascade-risks)).

### 5. Dynamic dependencies complicate reasoning

If an effect reads different signals depending on a condition, the dependency
graph changes on each execution:

```typescript
createEffect(() => {
    if (showDetails()) {
        console.log(details());  // dependency only when showDetails() is true
    }
});
```

The system must track which signals were actually read on each run, clean up
stale subscriptions, and add new ones. This is a source of runtime cost and
subtle bugs — if `showDetails()` returns `true` for one run and then `false`,
the effect stops tracking `details()`, which means a subsequent change to
`details()` will not trigger the effect even if `showDetails()` returns `true`
again before the effect has a chance to re-run for a different reason.

### 6. Difficult integration with external update systems

Signals assume they own the mutation/notification cycle. When an external system
(GSAP tweens, physics engines, WebSocket updates) is the source of truth, the
signal model requires bridging: writing external values into signals each frame
so that effects can react.

```typescript
// GSAP tweens a plain object
const tweenTarget = { y: 0 };
gsap.to(tweenTarget, { y: 100, duration: 1.0 });

// To make this reactive, you must sync to a signal:
const [posY, setPosY] = createSignal(0);

// Option A: sync inside GSAP's callback
gsap.to(tweenTarget, {
    y: 100, duration: 1.0,
    onUpdate: () => setPosY(tweenTarget.y),
});
// Problem: effects fire inside GSAP's RAF tick, not yours.

// Option B: sync in your own tick
function tick() {
    setPosY(tweenTarget.y);  // write every frame, even if unchanged
    // Effects fire synchronously here
}
// Problem: you write 60 times/sec to a signal, each time triggering
// dependency checks, even though you could just read tweenTarget.y directly.
```

Both options add overhead and complexity that doesn't exist when the consumer
can simply read the external value directly (as in the watcher model).

See [Examples § GSAP Integration](examples.md#example-3-gsap-tween-integration)
for a detailed comparison of how each approach handles external tween sources.

## When Signals Are a Good Fit

- **UI-driven web applications** where components render in response to state
  changes (forms, dashboards, data grids, SPAs). Signals were designed for this.
- **Derived state is central** — when many computations depend on combinations
  of other reactive values, signals' automatic memoisation avoids manual cache
  management.
- **Your framework already provides signals** — if you are using SolidJS,
  Angular 16+, or Vue 3, signals are the idiomatic reactivity model. Fighting
  them adds more complexity than using them.
- **Moderate binding counts with infrequent changes** — signals' zero-cost
  idle and precise updates are most advantageous when bindings are numerous but
  changes are sparse (a settings panel, a configuration form).

## When Signals Are a Poor Fit

- **Tick-based game loops** where every value is read every frame anyway —
  signals' dependency tracking overhead is pure waste when the answer to "when
  should I re-evaluate?" is always "every tick."
- **External tween/physics engines own the update** — bridging external values
  into signals adds friction without benefit.
- **High-frequency continuous values** (positions, velocities, opacity during
  animation) — writing to signals 60 times per second triggers 60 dependency
  checks per second per signal, with no advantage over reading a plain property.
- **Ephemeral view lifecycles** — games and simulations where views are created
  and destroyed rapidly. Each lifecycle boundary is a potential leak if
  ownership disposal is missed.

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

However, testing effects requires running them inside a reactive root and
disposing it after the test:

```typescript
let captured = '';
const dispose = createRoot((dispose) => {
    createEffect(() => { captured = `Score: ${score()}`; });
    return dispose;
});

setScore(100);
assert.equal(captured, 'Score: 100');
dispose(); // clean up after test
```

This is more ceremony than testing a plain function or an event handler, and
the test must be aware of the signal runtime's synchronous/batching semantics.

---

> **Next:** [Watchers](watchers.md) — poll-based change detection for
> tick-driven architectures.
