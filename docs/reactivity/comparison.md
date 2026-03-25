# Comparison & Decision Framework

A side-by-side comparison of events, signals, and watchers - followed by a
decision framework to help you choose the right approach for your project.

> **Navigation:** [Overview](./) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · [Signals](signals.md) · [Watchers](watchers.md) ·
> Comparison · [Examples](examples.md)

---

## Side-by-Side Summary

| Dimension                 | Events (Pub/Sub)                                         | Signals                                                        | Watchers (Poll)                                          |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| **Model**                 | Push                                                     | Hybrid (push-pull)                                             | Pull                                                     |
| **Source awareness**      | Source must emit events                                  | Source must wrap values in signals                             | Source unaware - any readable value works                |
| **Consumer setup**        | Subscribe with `on()`                                    | Read signal inside reactive context                            | Wrap getters in `watch()`                                |
| **Cleanup required**      | Yes - `off()` per subscription                           | Yes - `dispose()` per ownership scope                          | No - stop polling, done                                  |
| **Leak risk**             | Real - missed `off()`                                    | Real - missed `dispose()`                                      | None                                                     |
| **Cost shape**            | O(emissions x subscribers); per-tick values read directly                               | O(changed) - idle bindings skipped;  | O(watched) every tick; per-tick values read directly     |
| **Derived state**         | Manual - check condition in every handler                | Automatic - `createMemo`                                       | Manual - model-layer computation or getter expressions   |
| **Timing control**        | Immediate on emit (or deferred if queued)                | Depends on scheduler / batch semantics                         | Consumer decides - always at poll time                   |
| **Consistency guarantee** | None inherent - cascades can read partial state          | Requires glitch prevention (scheduler)                         | Free - reads a post-update snapshot                      |
| **Framework dependency**  | None (built-in APIs)                                     | Signal runtime (SolidJS, Angular, etc.)                        | None (~20-30 lines of code)                              |
| **Debugging**             | Trace through dispatch + handler chain                   | Trace through dependency graph + scheduler                     | Step through render callback top-to-bottom               |

## Key Insights

**Events have the least overhead; watchers trade some speed for flexibility.**
Events are ~1.5x faster than watchers because they have zero cost on idle
ticks. Watchers let the _consumer_ decide what constitutes a meaningful change,
rather than requiring the _source_ to pre-declare every event. This means
models don't need to anticipate how views will consume their state, and views
can react to arbitrary derived conditions (e.g. "health dropped below 25%")
without modifying the source.

**Events and watchers both benefit from a hybrid pattern.** Per-tick state
(positions, velocities) should be read directly - no reactive overhead. The
reactive mechanism (event emission or watcher polling) handles only infrequent
discrete state: phase transitions, scores, spawn/despawn. This is why both
outperform signals at game scale - most per-frame state bypasses the reactive
layer.

**Signals must wrap all state.** Untracked reads are invisible to effects, so
per-tick values like positions must be signals too. This makes signals 10-20x
slower than events or watchers at game scale. In absolute terms the overhead
is still small (<0.1% of frame budget).

**Events and signals require explicit cleanup; watchers do not.** A missed
`off()` or `dispose()` keeps handlers or effects alive on detached objects
with no visible symptom. Watchers have no subscriptions to clean up - stop
polling and they're gone.

**All three approaches are fast enough at game-typical scale.** At 200 values:
events ~1us/tick, watchers ~1.5us, signals ~18us - all under 1% of the 16.6ms
frame budget. The choice depends on who controls notification (source vs
consumer), lifecycle management requirements, and whether a natural polling
point exists.

## Performance Characteristics

**At game-typical scale (50-200 values), the absolute cost of all three
approaches is a small fraction of the 16.6ms frame budget.** The choice
between approaches should be driven by correctness, maintainability, and
architectural fit - not performance. That said, the approaches differ
significantly in relative cost:

- **Events** are free when idle. Cost is proportional to the number of
  emissions and subscribers when things happen. Cascading events (handler A
  emits event B) can cause unpredictable spikes. In tick-based games, events
  are used for discrete/infrequent changes (score, phase, game over) while
  per-tick state (positions, velocities) is read directly - the same hybrid
  pattern as watchers. This makes events competitive with watchers in
  practice.
- **Signals** are free when idle. Cost is proportional to the number of
  values that _changed_ - unaffected effects are skipped entirely. All model
  state must be wrapped in signals, so per-tick values like positions trigger
  signal writes and effect re-runs every frame. The dependency tracking,
  dirty-marking, batch scheduling, and effect re-execution pipeline makes
  signals **9-12x slower than watchers** at game-typical scale, and up to
  **60x slower** for deep dependency graphs (diamond patterns).
- **Watchers** have a constant cost every tick proportional to the number
  of _watched_ values - not the total number of values. Per-tick values
  (positions, velocities) are read directly with no watcher overhead, so
  the polled set is typically small (10-50 values for phases, scores, lives).
  This hybrid approach makes watchers the fastest option in tick-based
  scenarios.

The three approaches differ in how much state goes through the reactive
mechanism. Signals must wrap _all_ state - including per-tick values like
positions - because untracked reads are invisible to effects. Events and
watchers can both use a hybrid pattern: only infrequently-changing state goes
through the reactive mechanism (event emissions or watcher polling), while
per-tick state is read directly. This structural advantage is the main reason
events and watchers outperform signals in tick-based games - most per-frame
state bypasses the reactive mechanism entirely.

### Benchmarks

This repository includes benchmark suites that measure all three approaches as
they would actually be used: events and watchers use the hybrid pattern
(emit/watch infrequent state, read per-tick state directly), while signals
wrap all state in signals.

- `benchmarks/reactivity-simple.bench.ts` - single entity, 3 per-tick mutations
  plus 1 infrequent change. Simple and focused.
- `benchmarks/reactivity.bench.ts` - scaling scenarios: typical game ticks,
  ticks with state changes, watcher polling overhead, diamond dependency graphs,
  and simulated game sessions.

Run with `npm run bench`. Representative results at 100 values (typical tick,
per-tick only):

| Approach | ops/sec | Relative |
|----------|---------|----------|
| Events + direct reads | 2.0M | 1.0x (fastest) |
| Watchers + direct reads | 1.3M | 1.5x slower |
| Signals (all values are signals) | 135K | 15x slower |

> **Note on testing SolidJS signals in Node/Vitest:** Vitest resolves
> `solid-js` to the SSR build by default (Node export condition) where effects
> and memos are **inert stubs**. This silently produces misleadingly fast signal
> benchmarks because no reactive propagation occurs. The project's
> `vite.config.ts` aliases `solid-js` to the client runtime to ensure
> benchmarks measure real reactive behaviour. Always verify that effects
> actually fire when benchmarking signals.

## Correctness Properties

### Consistency (Freedom from Glitches)

A "glitch" is when a computation sees inconsistent state - some values at their
new state, others still at their old state.

- **Events:** Susceptible to glitches. A handler that reads multiple model
  properties during a partially-completed update sees mixed state. Mitigation:
  emit events only after all mutations are complete.

- **Signals:** Glitch-free within a batch, _if_ the signal runtime provides
  topological scheduling. This is a core guarantee of SolidJS and the TC39
  proposal - computations re-execute in dependency order, so a downstream
  computation always sees fully-updated upstream values.

- **Watchers:** Glitch-free by construction in a tick-based architecture. All
  model updates complete before render callbacks run. Every getter reads a
  consistent post-update snapshot. No scheduler needed.

### Lifecycle Safety

- **Events:** Leaks if `off()` is missed. Failure mode: handler runs on
  detached/destroyed object, silently consuming resources.

- **Signals:** Leaks if `dispose()` is missed. Failure mode: effect runs on
  detached view, silently consuming resources. Harder to detect than a missing
  event handler because the leaked effect may produce no visible symptom.

- **Watchers:** No cleanup needed. Failure mode: if `poll()` is never called
  in the render callback, the watched feature simply doesn't update - which is
  _visible_ in testing/gameplay.

### Accessor Transparency

- **Events:** Subscriptions are explicit (`on('event', handler)`) - the
  reactive relationship is visible at the usage site.

- **Signals:** Signal reads vs. plain function calls look identical.
  Maintenance risk: refactoring a signal to a plain getter (or vice versa)
  silently changes reactive behaviour. This cannot be enforced at the type
  level.

- **Watchers:** All getter functions are treated uniformly. No distinction
  between "reactive" and "non-reactive" reads.

## Testability

- **Events:** Models with event emitters can be tested by subscribing and
  asserting on emitted payloads. The test must create an emitter, wire it to
  the model, and manage subscription cleanup. View tests require subscribing
  to events and verifying that handler logic produces the expected output.

- **Signals:** Models can be tested by writing to signals and asserting on
  computed values or effect side-effects. Tests must run inside a reactive
  root and dispose it afterwards. The test must be aware of the signal
  runtime's batching semantics - some assertions may need to account for
  deferred updates.

- **Watchers:** Models are plain objects - test with direct property reads and
  assertions. No reactive runtime, no roots, no disposal. Watcher logic can
  be tested by calling `poll()` and checking `changed` / `value` /
  `previous`. The test is a simple sequence of mutations and assertions with
  no framework ceremony.

See each approach's Testing Considerations section for code examples:
[Events](events.md#testing-considerations),
[Signals](signals.md#testing-considerations),
[Watchers](watchers.md#testing-considerations).

## Maintainability

- **Events:** As the system grows, the runtime flow becomes implicit and
  distributed. Understanding what happens when an event fires requires
  searching the entire codebase for subscribers. Refactoring event names or
  payloads requires updating all subscribers. Typed event maps help, but the
  relationship between emitter and subscriber is only discoverable at runtime.

- **Signals:** Dependencies are local and automatic - reading the effect code
  shows what it depends on. However, the invisible boundary between signal
  accessors and plain functions (see
  [Signals § Drawback 3](signals.md#3-invisible-reactivity-boundary--signals-vs-plain-functions))
  means refactoring a signal to a plain getter silently breaks reactivity.
  Ownership and disposal semantics add a dimension that must be maintained
  across every component lifecycle.

- **Watchers:** All reactive behaviour is visible in the render callback,
  readable top-to-bottom. Refactoring a model property does not change
  reactive semantics - any readable value can be watched. No disposal or
  subscription lifecycle to maintain. The trade-off is that derived state must
  be maintained at the model layer rather than expressed declaratively with
  `createMemo`.

## Programming Model

Each approach imposes different constraints on how code is written. This section
compares what the author needs to understand and think about to use each
approach correctly.

### Events

State and data structures are plain JavaScript - no wrappers, no special
accessors. The reactive requirements are concentrated at the boundaries: the
source must emit events, and the consumer must subscribe and unsubscribe.

What the author needs to think about:

- **Deciding what to emit and when.** The source must choose which state
  transitions are worth announcing. This is a design decision that constrains
  what consumers can react to - if no event exists for a particular change,
  consumers can't observe it without polling.
- **Emit timing.** Events should be emitted _after_ all related mutations are
  complete. Emitting mid-update means handlers may read partially-updated
  state (a glitch).
- **Subscription lifecycle.** Every `on()` needs a corresponding `off()`.
  Forgetting `off()` is a silent leak. The author must plan cleanup paths for
  every subscriber, especially for short-lived objects.
- **Late subscribers miss history.** There is no "current value" for an event.
  If a subscriber is added after an event was emitted, it has no way to
  recover the missed information. The author must handle initial state
  separately from ongoing changes.
- **Cascading.** A handler that emits another event creates implicit ordering
  and execution depth. The author must be aware of these chains and avoid
  circular cascades.
- **Event contract maintenance.** Renaming an event or changing its payload
  requires updating all subscribers. Typed event maps catch some of this at
  compile time, but the relationship between emitter and subscriber is only
  fully discoverable at runtime.

### Signals

State is accessed through getter/setter function pairs (`x()` to read,
`setX()` to write) rather than plain properties. The author works within a
reactive runtime that tracks dependencies automatically but requires awareness
of its execution model.

What the author needs to think about:

- **Getter/setter function pairs.** All reactive state uses `const [x, setX] =
  createSignal(initial)`. Reads and writes go through function calls, not
  property access. This changes how data structures are defined and composed.
- **Reactive context awareness.** A signal read inside an effect or memo
  registers a dependency. The same read outside a reactive context is just a
  function call with no reactive behaviour. The author must know which context
  they're in.
- **Choosing between `createSignal` and `createMemo`.** Source state uses
  signals; derived state uses memos. Getting this distinction wrong (e.g.
  using a signal for derived state and manually keeping it in sync) negates
  the benefit of automatic tracking.
- **Batching with `batch()`.** Multiple signal writes without batching cause
  intermediate effect re-executions. The author must group related writes in
  `batch()` calls to avoid wasted work and potential glitches.
- **Ownership and disposal.** Reactive roots (`createRoot`) own all effects
  and memos created inside them. The author must create roots at the right
  scope and call `dispose()` when done. Forgetting disposal is a silent leak.
  Nested ownership (effects inside effects) adds further complexity.
- **The invisible boundary.** A signal accessor and a plain function have
  identical syntax - `getScore()` could be either. Refactoring one to the
  other silently changes reactive behaviour. The type system cannot enforce
  this distinction.
- **Untracked reads.** Sometimes a signal should be read without creating a
  dependency. The author must know when to use `untrack()` and understand the
  consequences of omitting it.
- **Immutable update patterns for collections.** Signal writes use
  reference equality by default. Mutating an array or object in place and
  writing it back may not trigger updates. The author must use immutable
  patterns or specialized stores for aggregate state.

### Watchers

State is plain JavaScript properties and getter functions. The reactive
mechanism is a simple poll loop - the author wraps getter expressions in
`watch()` and checks for changes each tick.

What the author needs to think about:

- **What to watch vs what to read directly.** Values that change every tick
  (positions, velocities) should be read directly - watching them wastes
  poll cycles on comparisons that always detect a change. Watchers are for
  infrequent state: phases, scores, lives.
- **Remembering to poll.** A watcher that is never polled silently does
  nothing. The author must ensure `poll()` is called in the render loop. The
  failure mode is visible (the feature doesn't update) but the cause may not
  be obvious.
- **Getter cost.** Watcher getters run every tick. They should be O(1) -
  no array traversals, allocations, or string concatenation. Expensive getters
  are a hidden hot-path cost.
- **Derived state stays in the model.** There is no declarative `createMemo`
  equivalent. Derived values (e.g. "is the player near an enemy") must be
  computed at the model layer and exposed as getters. The author decides where
  derivation logic lives.
- **Equality semantics.** The default comparison is `===`. For aggregate
  values (arrays, objects), the author must choose a strategy: watch a scalar
  proxy (length, version stamp), compute derived state in the model, or
  provide a custom equality function. See
  [Watchers § Aggregate Values](watchers.md#aggregate-values-arrays-and-objects).

## Architectural Fit

### Tick-Based Games and Simulations

**Best fit: Watchers + direct reads**

The tick loop provides a natural polling point. Model updates complete before
view refreshes, guaranteeing consistency. Views are often ephemeral (enemies,
particles, effects), making zero-cleanup lifecycle management valuable.

Signals' dependency tracking adds complexity without much benefit in this
context - the tick already answers "when to re-evaluate" (every frame).

**Typical hybrid pattern:**

```
Watchers  → infrequently-changing state (phases, scores, lives)
Direct reads → per-frame state (positions, velocities, timers)
```

### UI-Driven Web Applications

**Best fit: Signals**, with events for cross-component communication.

UI apps are event-driven (user interactions), not tick-driven. There is no
natural polling point - signals provide the "when to update" answer
automatically. Component rendering models (SolidJS, Angular, Vue) are designed
around signals and re-render only when dependencies change.

Watchers would require introducing a polling loop (`requestAnimationFrame` or
`setInterval`) to check for changes, which replicates what signals do
automatically.

**Typical hybrid pattern:**

```
Signals   → component state and derived values
Events    → user interactions, cross-component messages, external data sources
```

### Interactive Simulations and Visualisations

**Depends on the update model.**

If the simulation has a fixed-rate tick (physics sim, cellular automaton, fluid
dynamics viz) → watchers align well, same as games.

If the simulation is primarily event-driven (user manipulates parameters → viz
updates) → signals may be more natural, same as UI apps.

Many simulations are hybrid: a tick loop for the simulation itself, plus UI
controls for user interaction. A pragmatic approach uses watchers for the
simulation render loop and signals (or events) for the UI layer.

### Loosely-Coupled and Plugin Architectures

**Best fit: Events.**

When the source and consumer are developed independently (plugins, extensions,
modular systems), events may provide the loosest coupling. The source defines an
event contract; consumers subscribe to what they need.

Signals require the consumer to access signal instances from the source, which
creates coupling around the ubiquitous use of signals, which may or may not be
acceptable depending on the system.

Watchers couple the consumer to public source interfaces - though this coupling can be removed with a **bindings interface**
pattern: the consumer declares a `Bindings` interface describing only the
properties it needs, and wiring code adapts this to the source interface.
With bindings, the consumer and source can vary independently as long as the
interface contract is met, achieving decoupling comparable to events:

```typescript
// Consumer defines what it needs - doesn't know or care about the source
interface HudBindings {
    getScore(): number;
    getLives(): number;
}

function createHudView(bindings: HudBindings): Container {
    /* ... */
}
```

## Common Pitfalls Across All Approaches

### 1. Forgetting lifecycle cleanup (Events, Signals)

Both events and signals require explicit cleanup. Budget cleanup code into
every component that subscribes. Use disposable/cleanup patterns (see
[Events § Drawback 1](events.md#1-subscription-lifecycle-is-manual-and-error-prone),
[Signals § Drawback 2](signals.md#2-effect-cleanup-and-ownership-must-be-managed)).

### 2. Expensive getter expressions (Watchers)

Watcher getters run every tick. Array traversals, object allocations, and
string concatenation in getters consume frame budget unnecessarily. Keep
getters O(1) - see [Watchers § Aggregate Values](watchers.md#aggregate-values-arrays-and-objects).

### 3. Cascading updates (Events, Signals)

Events can cascade (handler emits another event). Signals can cascade
(effect writes to another signal). Both create unpredictable execution
depth and ordering. Minimise cross-reactive writes - prefer unidirectional
data flow.

### 4. Assuming one approach fits all subsystems

A game with a settings menu, a simulation with parameter sliders, a dashboard
with real-time charts - each has subsystems with different update models. Match
the approach to the subsystem, not the project as a whole.

---

> **Next:** [Worked Examples](examples.md) - each approach applied to the same
> scenarios across different project types.
