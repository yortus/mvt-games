# Watchers (Poll-Based Change Detection)

Watchers are a lightweight pull-based reactivity mechanism: a consumer polls a
source on each tick and compares the result to a cached value. If the value
differs, a change is reported.

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · [Signals](signals.md) · Watchers ·
> [Comparison](comparison.md) · [Examples](examples.md)

---

## How It Works

On each tick, the consumer reads a value, compares it to the previously cached
value, and reacts if the two differ.

```
Tick N:   newVal = getValue()  →  'idle'      prevVal: 'idle'      changed? no
Tick N+1: newVal = getValue()  →  'running'   prevVal: 'idle'      changed? YES
Tick N+2: newVal = getValue()  →  'running'   prevVal: 'running'   changed? no
```

This is a pure **pull** model (see [Push vs Pull](push-vs-pull.md)): the
consumer initiates every check. The source does not know it is being observed.
There is no subscription, no event, no dependency graph.

## The Basic Concept

At its simplest, a watcher is just a pair of variables - current and previous -
compared each tick:

```typescript
// Bare-bones change detection - no abstraction needed
let prevPhase = model.phase;

function refresh() {
    const currPhase = model.phase;
    if (currPhase !== prevPhase) {
        // phase changed - react
        phaseText.text = currPhase.toUpperCase();
        prevPhase = currPhase;
    }
}
```

This works, but repeating the pattern for many values is verbose and
error-prone. A small abstraction can encapsulate it.

## Implementation: `Watcher`

A view typically watches several values at once. `createWatcher` accepts a
record of getter functions and provides a single `poll()` call that advances
all state together:

```typescript
interface Watcher<T extends Record<string, () => unknown>> {
    poll(): WatchedValues<T>;
}

type WatchedValues<T extends Record<string, () => unknown>> = {
    readonly [K in keyof T]: WatchedProperty<ReturnType<T[K]>>;
};

interface WatchedProperty<T> {
    readonly changed: boolean;
    readonly value: T;
    readonly previous: T | undefined;
}

function createWatcher<T extends Record<string, () => unknown>>(getters: T): Watcher<T> {
    const keys = Object.keys(getters) as (keyof T)[];
    const reads = keys.map(k => getters[k]);
    const state = reads.map(() => ({
        changed: false,
        value: undefined as unknown,
        previous: undefined as unknown,
    }));
    const watched = Object.fromEntries(
        keys.map((k, i) => [k, state[i]]),
    ) as WatchedValues<T>;

    return {
        poll(): WatchedValues<T> {
            for (let i = 0; i < keys.length; ++i) {
                const next = reads[i]();
                const s = state[i];
                s.previous = s.value;
                s.changed = next !== s.value;
                if (s.changed) s.value = next;
            }
            return watched;
        },
    };
}
```

**Key design choices:**

- **`poll()` advances all state and returns it.** The returned `WatchedValues`
  object is the only way to access `changed` / `value` / `previous` — forcing
  consumers to call `poll()` before reading. This makes it impossible to
  accidentally read stale flags from a previous tick.
- **First poll detects all values as changed.** Before the first `poll()`,
  internal values are `undefined`. The first call compares `undefined` to the
  current getter result, so `changed` is `true` for every non-`undefined` value.
  This means views can defer all state-dependent setup to `refresh()` — the
  first render naturally runs every `if (watched.xxx.changed)` branch,
  eliminating duplication between factory init and refresh logic.
- **`previous` is `T | undefined`.** On the first poll, `previous` is
  `undefined` (there was no prior observation). This type signature forces
  consumers who use `previous` to handle the first-poll edge case — e.g. for
  side effects that should only fire on actual transitions:
  ```typescript
  if (watched.score.changed && watched.score.previous !== undefined) {
      playScoreChangeSound();  // skipped on first poll
  }
  ```
- **No subscription, no disposal.** When the view that owns the watcher is
  removed from the scene graph, the watcher becomes unreachable and is
  garbage-collected.

## Minimal Working Example

A score and phase display for a Pac-Man-style game. The view returns a
`Container` - the caller adds it to the stage. The `onRender` callback is
invoked by Pixi's ticker automatically while the view is on stage.

```typescript
// --- Model (plain object, no reactivity awareness) ---

interface GameModel {
    readonly score: number;
    readonly phase: 'ready' | 'playing' | 'game-over';
    readonly lives: number;
    readonly power: number;  // 0..1, changes every tick when charging
}

function createGameModel(): GameModel {
    const model = {
        score: 0,
        phase: 'ready' as GameModel['phase'],
        lives: 3,
        power: 0,
    };
    return model;
}

// --- View ---

function createHudView(model: GameModel): Container {
    const view = new Container();
    const scoreText = new Text({ style: { fill: 'white', fontSize: 24 } });
    const livesText = new Text({ style: { fill: 'red', fontSize: 24 } });
    const phaseText = new Text({ style: { fill: 'yellow', fontSize: 32 } });
    const powerBar = new Graphics();
    livesText.y = 30;
    phaseText.y = 60;
    powerBar.y = 100;
    view.addChild(scoreText, livesText, phaseText, powerBar);

    // Watch infrequently-changing state
    const watcher = createWatcher({
        score: () => model.score,
        lives: () => model.lives,
        phase: () => model.phase,
    });

    view.onRender = () => {
        // Poll all watched values
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText.text = String(watched.score.value);
        }
        if (watched.lives.changed) {
            livesText.text = '♥'.repeat(watched.lives.value);
        }
        if (watched.phase.changed) {
            phaseText.text = watched.phase.value.toUpperCase();
        }

        // Frequently-changing value - just read directly, no watcher needed
        powerBar.clear().rect(0, 0, model.power * 100, 8).fill('lime');
    };

    return view;
}

// --- Usage ---

const model = createGameModel();
const hud = createHudView(model);
app.stage.addChild(hud);

// When the HUD is no longer needed:
app.stage.removeChild(hud);
// onRender stops being called → watchers become idle → GC'd with the view.
// No subscriptions to clean up. No dispose() to call.
```

The model is a plain object. The view reads it through watchers (for infrequent
changes) and direct reads (for per-tick values). No events, no signals, no
framework.

Note that the text nodes are created without initial text content — there is no
`text: '0'` or `text: 'READY'`. The first `poll()` detects all values as
changed (they transition from `undefined` to their current value), so the
`if (watched.xxx.changed)` branches run on the first render and set the correct
text. This eliminates the need to duplicate initial state setup in the factory.

**An important idiom:** values that change every tick (like `power`) don't
need a watcher - just read them directly. Watchers are most valuable for
**infrequently-changing state**, where they avoid redundant view updates. For
state that changes every frame, a direct read is simpler and cheaper. This means
watcher systems are cheap for both high- and low-frequency state: direct reads
for hot values, watched reads for cold values.

## Design Considerations

### Aggregate Values (Arrays and Objects)

The default `===` comparison works for primitives but has known issues with
reference types:

| Scenario | Problem |
|----------|---------|
| Array mutated in place (`items.push(x)`) | Same reference → `===` says unchanged → change **missed** |
| Getter returns new array each call (`items.filter(...)`) | New reference each tick → `===` says changed → fires **every tick** |

**Recommended approaches, in order of preference:**

1. **Watch a scalar property** that captures what you care about:
    ```typescript
    const watcher = createWatcher({
        enemyCount: () => model.enemies.length,  // O(1)
    });
    ```

2. **Use a version stamp** at the model layer:
    ```typescript
    // Model increments a counter on each mutation
    const watcher = createWatcher({
        itemsVersion: () => model.itemsVersion,  // O(1)
    });
    const watched = watcher.poll();
    if (watched.itemsVersion.changed) {
        rebuildItemViews(model.items); // O(n) only when needed
    }
    ```

3. **Compute derived state in the model**, not in the getter:
    ```typescript
    // Model maintains totalScore incrementally
    const watcher = createWatcher({
        total: () => model.totalScore,  // O(1) read
    });
    // Instead of:
    // total: () => items.reduce((s, i) => s + i.score, 0)  // O(n) every tick!
    ```

4. **Custom equality** as a last resort for small, bounded collections:
    ```typescript
    function createWatchWithEquals<T>(read: () => T, equals: (a: T, b: T) => boolean): Watch<T> {
        let current = read();
        return {
            changed(): boolean {
                const next = read();
                if (equals(next, current)) return false;
                current = next;
                return true;
            },
            get value() { return current; },
        };
    }
    // Warning: O(n) comparison every tick - only suitable for small arrays
    ```

**Rule of thumb:** Getter expressions run every tick. Keep them O(1) with zero
heap allocation. No `array.map()`, `array.filter()`, `array.reduce()`,
`array.some()`, spread, or template-string composition in getter expressions.

## Benefits

### 1. No coupling to sources

The model doesn't need to extend a base class, implement an interface, declare
events, or wrap values in signal containers. Any readable property or getter is
watchable:

```typescript
// Model is a plain object - no reactivity boilerplate
const model = { x: 0, y: 0, phase: 'idle' };

// View watches whatever it wants
const watcher = createWatcher({
    x: () => model.x,
    phase: () => model.phase,
});
```

This means models can be developed and tested in complete isolation from the
reactivity system. This also applies to signals: the source must wrap values in
signal containers for them to be reactive. If you don't control the source and
it doesn't use signals, you cannot react to its changes with signal effects.

### 2. No subscription lifecycle management - zero leak risk

A watcher is a closure with a cached value. It has no back-references - no
signal knows about it, no subscriber list holds it. When the view that owns the
watcher is removed from the scene graph, the watcher becomes unreachable and is
garbage collected like any other object.

```typescript
function createEnemyView(model: EnemyModel): Container {
    const view = new Container();
    const sprite = new Sprite(texture);
    view.addChild(sprite);

    const watcher = createWatcher({
        phase: () => model.phase,
    });

    view.onRender = () => {
        const watched = watcher.poll();
        if (watched.phase.changed) {
            applyPhaseAppearance(sprite, watched.phase.value);
        }
        // Per-frame position - direct read, no watcher
        sprite.x = model.x * TILE_SIZE;
        sprite.y = model.y * TILE_SIZE;
    };

    return view;
}
```

In a game like Space Invaders where 55 enemies are created and destroyed
each wave, this means 55 view lifecycles with zero cleanup obligations. Compare
this to events (55 × `off()` calls) or signals (55 × `dispose()` calls).

### 3. Deterministic timing

All watchers evaluate inside the render callback, which is called at a known
point in the frame loop - after model updates, before rendering. There is no
scheduler, no deferred execution, no asynchronous notification. The order of
evaluation is the order the code is written in.

```typescript
view.onRender = () => {
    const watched = watcher.poll();
    // These run in exactly this order, every frame, predictably
    if (watched.score.changed) { /* ... */ }   // 1st
    if (watched.phase.changed) { /* ... */ }   // 2nd
    if (watched.lives.changed) { /* ... */ }   // 3rd
};
```

**Consistency is structural, not algorithmic.** Because all model updates
happen before render callbacks, every getter reads a consistent snapshot of
state. There is no possibility of "glitches" (seeing partially-updated state).
This guarantee comes for free from the tick ordering - no batching or
topological sorting needed.

**Low latency:** in a well-structured tick loop (model updates → view
refreshes), a change made during the model update is detected by watchers in the
view refresh of the *same tick*.

### 4. Any expression can be watched

Watchers accept any `() => T` function. This means consumers can watch derived
values, computed expressions, or conditions without the source declaring
anything:

```typescript
const watcher = createWatcher({
    // Plain property
    score: () => model.score,

    // Derived condition
    isGameOver: () => model.lives <= 0,

    // Computed value (keep it O(1)!)
    gridSize: () => model.rows * model.cols,

    // Cross-model boundary
    enemyNearPlayer: () =>
        Math.abs(enemy.col - player.col) <= 1 &&
        Math.abs(enemy.row - player.row) <= 1,
});
```

The consumer defines what is interesting at the point of use. The source need
not anticipate it. This is a significant advantage over both events and signals.
With events, the source must pre-declare which events it emits. With signals,
the source must wrap values in signal containers for them to be tracked - if a
value isn't a signal, it can't trigger effects.

### 5. Trivial to implement, no dependencies

The reference implementation is ~25 lines. There is no external library, no
build-time plugin, no runtime framework.
The team owns every line of code and can modify it freely. If avoiding vendored
dependencies on reactivity runtimes is a project goal, watchers are the
lightweight choice.

### 6. Uniform treatment of all reads

Every source passed to `createWatcher` is treated identically - whether it reads
a plain property, a signal, a computed value, or a dynamic expression. There is
no distinction between "reactive" and "non-reactive" reads. This eliminates the
[invisible reactivity boundary](signals.md#3-invisible-reactivity-boundary--signals-vs-plain-functions)
that affects signal-based systems.

### 7. Cheap for both high- and low-frequency state

For state that changes infrequently (phase, level, lives), watchers detect
changes with a tiny per-tick cost (~1–5 nanoseconds per check - see
[Drawback 1](#1-on-per-tick-cost-regardless-of-changes)). For state that
changes every tick (positions, velocities, timers), the idiomatic approach is to
skip the watcher and read the value directly - which is even cheaper.

In contrast, events are zero-cost for infrequent changes but expensive for
high-frequency state (60 emissions per second per value). Signals are zero-cost
when idle but add dependency-tracking overhead and GC pressure for
high-frequency writes. Watchers (combined with direct reads) have the most
uniform and predictable cost profile across both ends of the spectrum.

## Drawbacks

### 1. O(n) per-tick cost regardless of changes

Every watcher evaluates its getter every tick, even if nothing changed. For N
watchers, the per-tick cost is N getter calls + N comparisons. This cost is
constant - the same whether zero values changed or all of them changed.

**How significant is this?** For primitive property reads and `===`
comparisons, the per-check cost is approximately **1–5 nanoseconds** on modern
hardware. At 100 watches:

$$cost_{per\_tick} \approx 100 \times 5\text{ns} = 500\text{ns} = 0.5\text{μs}$$

A 60fps frame budget is ~16.6ms, so 100 primitive watchers consume
approximately **0.003%** of the frame budget. GC pressure is near zero - the
getter closures and cached values are long-lived, and `===` comparison allocates
nothing.

The cost becomes meaningful only when:
- Getter expressions are expensive (violating the O(1) rule)
- Watcher count is very high (thousands)
- The application has an extremely tight frame budget

For comparison, see the cost estimates for [events](events.md#1-zero-cost-when-nothing-happens)
(~50–200ns per subscriber per emission) and [signals](signals.md#1-dependency-tracking-has-per-read-overhead)
(~12–42ns per tracked read, plus heap allocations for subscription bookkeeping).

### 2. Developer must remember to poll

A watcher whose `poll()` is never called silently does nothing. There is no
error, no warning. If a developer creates a watcher but forgets to poll it,
the feature simply doesn't work.

The failure mode is *visible in gameplay* (the feature doesn't work), which
makes it relatively easy to catch in testing - but it is a manual obligation
that push-based systems (events and signals) avoid.

### 3. Expensive getters are a hidden hot-path risk

Because getter expressions run every tick, it is easy for inattentive developers
to inadvertently place expensive operations on the hot path. Unlike event
handlers or signal effects (which run only when triggered), watcher getters run
unconditionally - making the cost less obvious during code review.

```typescript
// Looks innocent, but runs O(n) EVERY tick:
const watcher = createWatcher({
    activeCount: () => model.enemies.filter(e => e.alive).length,
});
```

The `filter()` call creates a new array on every tick, consuming both CPU and
memory. The fix is to maintain `activeCount` incrementally in the model or watch
a version stamp - but the risk is that the developer doesn't realise the getter
is called 60 times per second.

**Mitigation:** establish a team convention that all watcher getters must be
O(1) with zero allocation, and review getter expressions during code review.

### 4. No built-in derived state management

Signals provide `createMemo` for automatic, memoised derived state. Watchers
offer no equivalent - derived state must be maintained at the model layer or
computed in getter expressions (subject to the O(1) constraint).

However, plain models can express derived state declaratively:

```typescript
function createDamageModel() {
    let base = 10;
    let bonus = 0;
    let critMult = 1.0;

    return {
        get total() { return base + bonus * critMult; },  // computed on read
        setBase(v: number) { base = v; },
        setBonus(v: number) { bonus = v; },
        setCritMult(v: number) { critMult = v; },
    };
}
```

The getter `total` computes derived state on demand - no manual cache
invalidation needed. For more expensive computations, the model can internally
memoise:

```typescript
function createLeaderboardModel() {
    const scores: number[] = [];
    let sorted: number[] = [];
    let dirty = false;

    return {
        addScore(s: number) { scores.push(s); dirty = true; },
        get topScores() {
            if (dirty) { sorted = [...scores].sort((a, b) => b - a); dirty = false; }
            return sorted;
        },
    };
}
```

This is more code than a `createMemo`, but it keeps the computation at the model
layer and avoids any reactive runtime.

### 5. Fan-out inefficiency

If 10 views watch the same property, each evaluates the getter independently.
An event or signal system would compute the value once and distribute it.

In practice, the cost of 10 redundant property reads is negligible (property
access is a single pointer dereference), but for expensive getters this could
matter. The mitigation is the same O(1) getter rule - if the getter is cheap,
the fan-out cost is immaterial.

## When Watchers Are a Good Fit

- **Tick-based game loops** where a render callback runs every frame - the
  polling model aligns perfectly with the existing update cycle.
- **Systems with ephemeral views** (enemies, particles, effects) where lifecycle
  cleanup must be trivial.
- **Architectures that prize simplicity** - no framework, no runtime, no
  ownership model.
- **Integration with external update engines** (GSAP, physics) - watcher
  getters can read any mutable state, regardless of where it was updated.
- **Small to medium binding counts** (tens to low hundreds per view) where the
  O(n) polling cost is negligible.
- **Projects that want to avoid vendored dependencies** - watchers are
  implementable in ~20–30 lines with no external library, build plugin, or
  runtime framework.

## When Watchers Are a Poor Fit

- **UI-driven applications** without a tick loop - there is no natural polling
  point, so you would need to create one (which replicates what signals do
  automatically).
- **Very large binding counts** (thousands) with mostly-idle values - the
  fixed O(n) cost per tick becomes wasteful when few values change. Signals'
  zero-cost idle is more efficient here.
- **Complex derived state graphs** - maintaining derived values manually at the
  model layer becomes verbose when the graph is deep or spans many models.
  Signals' automatic memoisation scales better in this scenario.
- **Asynchronous or event-driven data flows** - watchers detect changes per
  tick, which adds up to ~16ms latency for external changes that arrive between
  ticks. For cases where immediate response matters (e.g. network message → UI
  update), events or signals react instantly.

## Testing Considerations

Watchers are straightforward to test because they are pure functions with no
framework dependencies:

```typescript
// Test: watcher detects change
const model = { score: 0, phase: 'idle' as string };
const watcher = createWatcher({
    score: () => model.score,
    phase: () => model.phase,
});

// First poll — detects initial values as changed (from undefined)
const first = watcher.poll();
assert.equal(first.score.changed, true);       // undefined → 0
assert.equal(first.score.value, 0);
assert.equal(first.score.previous, undefined);  // no prior observation

// No change — same values
const second = watcher.poll();
assert.equal(second.score.changed, false);

// Mutation detected
model.score = 100;
const third = watcher.poll();
assert.equal(third.score.changed, true);
assert.equal(third.score.value, 100);
assert.equal(third.score.previous, 0);

// Stable again
const fourth = watcher.poll();
assert.equal(fourth.score.changed, false);
```

No reactive roots, no disposal, no batching semantics to account for. The test
is a simple sequence of mutations and assertions.

---

> **Next:** [Comparison & Decision Framework](comparison.md) - all three
> approaches side by side with guidance on choosing.
