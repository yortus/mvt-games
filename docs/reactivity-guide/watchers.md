# Watchers (Poll-Based Change Detection)

Watchers are a lightweight pull-based reactivity mechanism: a consumer polls a
getter function on each tick and compares the result to a cached value. If the
value differs, a change is reported.

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · [Signals](signals.md) · Watchers ·
> [Comparison](comparison.md) · [Examples](examples.md)

---

## How It Works

A watcher wraps a getter function. On each call to `changed()` (or `poll()`),
it evaluates the getter, compares the new value to the previously cached value
using `===`, and reports whether a change occurred.

```
Tick N:   getter() → 'idle'   cache: 'idle'   changed? no
Tick N+1: getter() → 'running' cache: 'idle'  changed? YES → cache: 'running'
Tick N+2: getter() → 'running' cache: 'running' changed? no
```

This is a pure **pull** model (see [Push vs Pull](push-vs-pull.md)): the
consumer initiates every check. The source does not know it is being observed.
There is no subscription, no event, no dependency graph.

## Reference Implementation

A minimal watcher in ~20 lines of TypeScript:

```typescript
interface Watch<T> {
    /** Returns 1 if the value changed since the last call, 0 otherwise. */
    changed(): number;
    /** The most recent value (updated on each changed() call). */
    readonly value: T;
}

function createWatch<T>(read: () => T): Watch<T> {
    let current = read();

    return {
        changed(): number {
            const next = read();
            if (next === current) return 0;
            current = next;
            return 1;
        },
        get value(): T {
            return current;
        },
    };
}
```

Note the deliberate design choices:
- `changed()` returns `number` (0 or 1), not `boolean`. This allows combining
  multiple watches with bitwise OR (`|`) to avoid short-circuit skipping
  (explained below).
- No subscription, no disposal, no framework. It is a closure with a cached
  value.

## Minimal Working Example

A score and phase display for a Pac-Man-style game:

```typescript
// --- Model (plain object, no reactivity awareness) ---

interface GameModel {
    readonly score: number;
    readonly phase: 'ready' | 'playing' | 'game-over';
    readonly lives: number;
}

function createGameModel(): GameModel {
    const model = {
        score: 0,
        phase: 'ready' as GameModel['phase'],
        lives: 3,
    };
    return model;
}

// --- View (uses watchers to detect changes) ---

function createHudView(model: GameModel, stage: Container) {
    const scoreText = new Text({ text: '0', style: { fill: 'white', fontSize: 24 } });
    const livesText = new Text({ text: '♥♥♥', style: { fill: 'red', fontSize: 24 } });
    const phaseText = new Text({ text: 'READY', style: { fill: 'yellow', fontSize: 32 } });
    livesText.y = 30;
    phaseText.y = 60;
    stage.addChild(scoreText, livesText, phaseText);

    // Declare watchers — each wraps a getter
    const scoreWatch = createWatch(() => model.score);
    const livesWatch = createWatch(() => model.lives);
    const phaseWatch = createWatch(() => model.phase);

    return {
        /** Called every frame by the ticker. */
        refresh() {
            // Poll all watchers — evaluate getters, compare to cache
            if (scoreWatch.changed()) {
                scoreText.text = String(scoreWatch.value);
            }
            if (livesWatch.changed()) {
                livesText.text = '♥'.repeat(livesWatch.value);
            }
            if (phaseWatch.changed()) {
                phaseText.text = phaseWatch.value.toUpperCase();
            }
        },

        destroy() {
            stage.removeChild(scoreText, livesText, phaseText);
            // No subscriptions to clean up — nothing to do
        },
    };
}

// --- Ticker loop ---

const model = createGameModel();
const hud = createHudView(model, app.stage);

app.ticker.add(() => {
    // model.update(deltaMs) would go here
    hud.refresh();
});
```

The model is a plain object. The view reads it through watchers. No events, no
signals, no framework.

## Design Considerations

### Why `number` (0/1) Instead of `boolean`?

Consider checking multiple watches:

```typescript
// With boolean return and logical OR — SHORT-CIRCUIT BUG:
if (a.changed() || b.changed()) {
    // If a.changed() returns true, b.changed() is NEVER CALLED.
    // b's internal state is not advanced this tick.
}
```

JavaScript's `||` operator short-circuits: if the left operand is truthy, the
right operand is not evaluated. This means `b.changed()` might never execute,
leaving `b`'s cache stale. On the next tick, `b` might report a change that
should have been detected earlier — or miss a change entirely.

With numeric return and bitwise OR, all operands are always evaluated:

```typescript
// With number return and bitwise OR — ALL watches polled:
if (a.changed() | b.changed()) {
    // Both a.changed() and b.changed() are ALWAYS called.
    // Bitwise | does not short-circuit.
    handleChange(a.value, b.value);
}
```

This eliminates short-circuit hazards while keeping the API simple. The
expression `a.changed() | b.changed()` is truthy (nonzero) if either or both
changed.

### Multiple Reads of `changed()` in the Same Tick

Because `changed()` advances internal state (evaluates the getter, updates the
cache), calling it a second time in the same tick will likely return `0` — the
value is the same as the just-updated cache. This is a potential pitfall:

```typescript
if (scoreWatch.changed()) {
    updateScoreDisplay(scoreWatch.value);
}

// Later in the same refresh():
if (scoreWatch.changed()) {
    // This NEVER runs — the cache was updated by the first call
    playScoringSound(scoreWatch.value);
}
```

**Mitigations:**

1. **Call `changed()` once per tick, store the result:**
    ```typescript
    const scoreChanged = scoreWatch.changed();
    if (scoreChanged) { updateScoreDisplay(scoreWatch.value); }
    if (scoreChanged) { playScoringSound(scoreWatch.value); }
    ```

2. **Use a `poll()` / `changed` split API** (separate advancing from reading):
    ```typescript
    interface Watch<T> {
        poll(): Watch<T>;          // advance state, return self
        readonly changed: boolean; // read-only, safe to read multiple times
        readonly value: T;
        readonly previous: T | undefined;
    }
    ```
    This design calls `poll()` once at the top, and `changed` can be read any
    number of times safely:
    ```typescript
    scoreWatch.poll();
    if (scoreWatch.changed) { updateScoreDisplay(scoreWatch.value); }
    if (scoreWatch.changed) { playScoringSound(scoreWatch.value); }
    ```

Both approaches work. The simpler `changed()` API (used in the reference
implementation) is sufficient when each watch is checked in a single `if` block.
The `poll()` / `changed` split is preferable in more complex `refresh()`
methods where a single value drives multiple reactions.

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
    const count = createWatch(() => model.enemies.length); // O(1)
    ```

2. **Use a version stamp** at the model layer:
    ```typescript
    // Model increments a counter on each mutation
    const itemsChanged = createWatch(() => model.itemsVersion); // O(1)
    if (itemsChanged.changed()) {
        rebuildItemViews(model.items); // O(n) only when needed
    }
    ```

3. **Compute derived state in the model**, not in the getter:
    ```typescript
    // Model maintains totalScore incrementally
    const total = createWatch(() => model.totalScore); // O(1) read
    // Instead of:
    // const total = createWatch(() => items.reduce((s, i) => s + i.score, 0)); // O(n) every tick!
    ```

4. **Custom equality** as a last resort for small, bounded collections:
    ```typescript
    function createWatchWithEquals<T>(read: () => T, equals: (a: T, b: T) => boolean): Watch<T> {
        let current = read();
        return {
            changed(): number {
                const next = read();
                if (equals(next, current)) return 0;
                current = next;
                return 1;
            },
            get value() { return current; },
        };
    }

    const items = createWatchWithEquals(
        () => model.items,
        (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    );
    // Warning: O(n) comparison every tick — only suitable for small arrays
    ```

**Rule of thumb:** Getter expressions run every tick. Keep them O(1) with zero
heap allocation. No `array.map()`, `array.filter()`, `array.reduce()`,
`array.some()`, spread, or template-string composition in getter expressions.

## Benefits

### 1. Zero coupling at the source

The model doesn't need to extend a base class, implement an interface, declare
events, or wrap values in signal containers. Any readable property is
watchable:

```typescript
// Model is a plain object — no reactivity boilerplate
const model = { x: 0, y: 0, phase: 'idle' };

// View watches whatever it wants
const xWatch = createWatch(() => model.x);
const phaseWatch = createWatch(() => model.phase);
```

This means models can be developed and tested in complete isolation from the
reactivity system.

### 2. No subscription lifecycle management — zero leak risk

A watcher is a closure with a cached value. It has no back-references — no
signal knows about it, no subscriber list holds it. When the view that owns the
watcher is destroyed and `refresh()` stops being called, the watcher becomes
unreachable and is garbage collected like any other object.

```typescript
function createEnemyView(model: EnemyModel, stage: Container) {
    const sprite = new Sprite(texture);
    stage.addChild(sprite);

    const xWatch = createWatch(() => model.x);
    const yWatch = createWatch(() => model.y);

    return {
        refresh() {
            if (xWatch.changed()) sprite.x = xWatch.value * TILE_SIZE;
            if (yWatch.changed()) sprite.y = yWatch.value * TILE_SIZE;
        },
        destroy() {
            stage.removeChild(sprite);
            // No subscriptions to clean up. xWatch and yWatch
            // are just closures — they'll be GC'd with the view.
        },
    };
}
```

In a game like Space Invaders where 55 enemies are created and destroyed
each wave, this means 55 view lifecycles with zero cleanup obligations. Compare
this to events (55 × `off()` calls) or signals (55 × `dispose()` calls).

### 3. Deterministic timing

All watchers evaluate inside `refresh()`, which is called at a known point in
the frame loop — after model updates, before rendering. There is no scheduler,
no deferred execution, no asynchronous notification. The order of evaluation
is the order the code is written in.

```typescript
refresh() {
    // These run in exactly this order, every frame, predictably
    if (scoreWatch.changed()) { /* ... */ }   // 1st
    if (phaseWatch.changed()) { /* ... */ }   // 2nd
    if (livesWatch.changed()) { /* ... */ }   // 3rd
}
```

**Consistency is structural, not algorithmic.** Because all model updates
happen before `refresh()`, every getter reads a consistent snapshot of state.
There is no possibility of "glitches" (seeing partially-updated state). This
guarantee comes for free from the tick ordering — no batching or topological
sorting needed.

### 4. Any getter expression can be watched

Watchers accept any `() => T` function. This means consumers can watch derived
values, computed expressions, or conditions without the source declaring
anything:

```typescript
// Watch a plain property
const score = createWatch(() => model.score);

// Watch a derived condition
const isGameOver = createWatch(() => model.lives <= 0);

// Watch a computed value (keep it O(1)!)
const gridSize = createWatch(() => model.rows * model.cols);

// Watch across model boundaries
const enemyNearPlayer = createWatch(
    () => Math.abs(enemy.col - player.col) <= 1 && Math.abs(enemy.row - player.row) <= 1
);
```

The consumer defines what is interesting at the point of use. The source need
not anticipate it. This is a significant advantage over events, where the source
must pre-declare which events it emits.

### 5. Trivial to implement, no dependencies

The reference implementation is ~20 lines. There is no external library, no
build-time plugin, no runtime framework. The team owns every line of code and
can modify it freely.

### 6. Uniform treatment of all getters

Every function passed to `createWatch` is treated identically — whether it reads
a plain property, a signal, a computed value, or a dynamic expression. There is
no distinction between "reactive" and "non-reactive" reads. This eliminates the
[invisible reactivity boundary](signals.md#3-invisible-reactivity-boundary--signals-vs-plain-functions)
that affects signal-based systems.

## Drawbacks

### 1. O(n) per-tick cost regardless of changes

Every watcher evaluates its getter every tick, even if nothing changed. For N
watchers, the per-tick cost is N getter calls + N comparisons. This cost is
constant — the same whether zero values changed or all of them changed.

**How significant is this?** For primitive property reads and `===`
comparisons, the per-check cost is approximately 1-5 nanoseconds on modern
hardware. At 100 watches:

$$cost_{per\_tick} \approx 100 \times 5\text{ns} = 500\text{ns} = 0.5\text{μs}$$

A 60fps frame budget is ~16.6ms, so 100 primitive watchers consume
approximately **0.003%** of the frame budget. This is negligible in practice.

The cost becomes meaningful only when:
- Getter expressions are expensive (violating the O(1) rule)
- Watcher count is very high (thousands)
- The application has an extremely tight frame budget

### 2. Latency clamped to tick rate

A change is detected at most one tick after it occurs. At 60fps (~16.6ms ticks),
this is imperceptible for visual updates. However, in systems with slower ticks
or where sub-tick responsiveness matters (e.g. audio triggering), this latency
may be unacceptable.

### 3. Developer must remember to poll

A watcher that is never called inside `refresh()` silently does nothing. There
is no error, no warning. If a developer adds a watcher but forgets to poll it,
the feature simply doesn't work.

```typescript
// Watcher declared...
const livesWatch = createWatch(() => model.lives);

refresh() {
    if (scoreWatch.changed()) { /* ... */ }
    // Oops — forgot to check livesWatch here.
    // The lives display never updates. Silent bug.
}
```

The failure mode is *visible in gameplay* (the feature doesn't work), which
makes it relatively easy to catch in testing — but it is a manual obligation
that push-based systems (events and signals) avoid.

### 4. No built-in derived state management

Signals provide `createMemo` for automatic, memoised derived state. Watchers
offer no equivalent — derived state must be maintained at the model layer or
computed in getter expressions (subject to the O(1) constraint).

This means the model layer must do more work when derived values span multiple
sources:

```typescript
// With signals — derived automatically
const totalDamage = createMemo(() => baseDamage() + bonusDamage() + critMultiplier());

// With watchers — model must maintain it
class DamageModel {
    #base = 10;
    #bonus = 0;
    #critMult = 1.0;
    #total = 10;  // must be updated at every mutation site

    setBase(v: number) { this.#base = v; this.#recalc(); }
    setBonus(v: number) { this.#bonus = v; this.#recalc(); }
    setCritMult(v: number) { this.#critMult = v; this.#recalc(); }

    #recalc() { this.#total = this.#base + this.#bonus + this.#critMult; }

    get total() { return this.#total; }
}
```

This is more code at the model layer. However, it keeps the computation at
mutation time (amortised, infrequent) rather than at read time (every tick),
and makes the model the single authority on its own derived state.

### 5. Fan-out inefficiency

If 10 views watch the same property, each evaluates the getter independently.
An event or signal system would compute the value once and distribute it.

In practice, the cost of 10 redundant property reads is negligible (property
access is a single pointer dereference), but for expensive getters this could
matter. The mitigation is the same O(1) getter rule — if the getter is cheap,
the fan-out cost is immaterial.

## When Watchers Are a Good Fit

- **Tick-based game loops** where a `refresh()` function runs every frame — the
  polling model aligns perfectly with the existing update cycle.
- **Systems with ephemeral views** (enemies, particles, effects) where lifecycle
  cleanup must be trivial.
- **Architectures that prize simplicity** — no framework, no runtime, no
  ownership model.
- **Integration with external update engines** (GSAP, physics) — watcher
  getters can read any mutable state, regardless of where it was updated.
- **Small to medium binding counts** (tens to low hundreds per view) where the
  O(n) polling cost is negligible.

## When Watchers Are a Poor Fit

- **UI-driven applications** without a tick loop — there is no natural polling
  point, so you would need to create one (which replicates what signals do
  automatically).
- **Very large binding counts** (thousands) with mostly-idle values — the
  fixed O(n) cost per tick becomes wasteful when few values change. Signals'
  zero-cost idle is more efficient here.
- **Complex derived state graphs** — maintaining derived values manually at the
  model layer becomes verbose when the graph is deep or spans many models.
  Signals' automatic memoisation scales better in this scenario.
- **Asynchronous or event-driven data flows** — watchers detect changes per
  tick, which adds up to 16ms latency. For cases where immediate response
  matters (e.g. network message → UI update), events or signals react
  instantly.

## Testing Considerations

Watchers are straightforward to test because they are pure functions with no
framework dependencies:

```typescript
// Test: watcher detects change
const model = { score: 0 };
const w = createWatch(() => model.score);

assert.equal(w.changed(), 0); // no change from initial value
model.score = 100;
assert.equal(w.changed(), 1); // change detected
assert.equal(w.value, 100);
assert.equal(w.changed(), 0); // no change since last check
```

No reactive roots, no disposal, no batching semantics to account for. The test
is a simple sequence of mutations and assertions.

---

> **Next:** [Comparison & Decision Framework](comparison.md) — all three
> approaches side by side with guidance on choosing.
