# Comparison & Decision Framework

A side-by-side comparison of events, signals, and watchers - followed by a
decision framework to help you choose the right approach for your project.

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · [Signals](signals.md) · [Watchers](watchers.md) ·
> Comparison · [Examples](examples.md)

---

## Side-by-Side Summary

| Dimension | Events (Pub/Sub) | Signals | Watchers (Poll) |
|---|---|---|---|
| **Model** | Push | Hybrid (push-pull) | Pull |
| **Source awareness** | Source must emit events | Source must wrap values in signals | Source unaware - any readable value works |
| **Consumer setup** | Subscribe with `on()` | Read signal inside reactive context | Wrap getters in `watch()` |
| **Cleanup required** | Yes - `off()` per subscription | Yes - `dispose()` per ownership scope | No - stop polling, done |
| **Leak risk** | Real - missed `off()` | Real - missed `dispose()` | None |
| **Cost when idle** | Zero | Zero (no computations re-run) | O(n) getter calls + comparisons |
| **Cost when changing** | O(subscribers) per event | Dependency tracking + topological sort + effect re-run | Same O(n) as idle |
| **Cost predictability** | Variable (depends on subscriber count and cascade depth) | Variable (depends on graph topology) | Constant |
| **GC pressure** | Low (long-lived callbacks; payload allocation on emit) | Moderate (subscription churn on re-runs; Set entry allocation) | Near zero (long-lived closures; `===` allocates nothing) |
| **Derived state** | Manual - check condition in every handler | Automatic - `createMemo` | Manual - model-layer computation or getter expressions |
| **Timing control** | Immediate on emit (or deferred if queued) | Depends on scheduler / batch semantics | Consumer decides - always at poll time |
| **Consistency guarantee** | None inherent - cascades can read partial state | Requires glitch prevention (scheduler) | Free - reads a post-update snapshot |
| **Framework dependency** | None (built-in APIs) | Signal runtime (SolidJS, Angular, etc.) | None (~20–30 lines of code) |
| **Debugging** | Trace through dispatch + handler chain | Trace through dependency graph + scheduler | Step through render callback top-to-bottom |

## Performance Characteristics

### Cost Model Comparison

The three approaches have fundamentally different cost profiles. The table below
shows how each behaves across a range of scenarios at 60fps.

| Scenario | Events | Signals | Watchers |
|---|---|---|---|
| **Nothing changes** (100 bindings) | 0μs | ~0μs | ~0.5μs |
| **5 of 100 values change** | ~0.5μs (5 emits × ~5 subs) | ~1–5μs (tracking + effects) | ~0.5μs (same as idle) |
| **All 100 values change** | ~5–10μs (100 emits) | ~20–100μs* (graph flush) | ~0.5μs (same as idle) |
| **GC pressure per tick** | Low (payload objects on emit) | Moderate (Set churn from subscription updates) | Near zero (no allocation) |
| **Worst-case spike** | Cascading emits (unbounded) | Deep diamond-graph flush | None - cost is constant |

\*Signal costs vary significantly with implementation and graph topology. These
values are illustrative; use the benchmarks below to measure your scenario.

The key pattern:

- **Events** are free when idle but have variable cost proportional to
  subscriber count and cascade depth when things happen. Cascading events
  (handler A emits event B) can cause unpredictable spikes.

- **Signals** are free when idle but have per-change overhead that includes
  dependency-graph traversal, topological sorting, cleanup of old subscriptions,
  and effect re-execution. The overhead also includes **GC pressure** from
  subscription churn - each effect re-run cleans up old Set entries and creates
  new ones. The worst case occurs with many simultaneous changes or deep
  dependency graphs.

- **Watchers** have a constant cost every tick - N getter evaluations and N
  comparisons, regardless of how many values changed. This means watchers are
  less efficient than signals during fully-idle periods, but more efficient (and
  more predictable) during active periods with many changes. Their near-zero GC
  pressure is an additional advantage in latency-sensitive applications.

### Benchmark Guidance

If you need empirical data to choose between approaches for a specific project,
here are five benchmarks that capture the meaningful differences:

**1. Steady-state overhead (nothing changes).** Create N reactive bindings
(watches / signal-effect pairs / event subscriptions). Measure cost per tick
when no values change. Watchers pay O(N); signals and events pay ~0. This
benchmark reveals the floor cost of watchers.

**2. All-change overhead (everything changes).** Mutate every value, then
measure the cost of a full tick. Watchers pay the same O(N). Signals pay
O(N) + dependency tracking + scheduling overhead. This reveals whether
signals' per-change overhead exceeds watchers' flat cost.

**3. Frame-time variance over a real session.** Record per-frame times over
60 seconds of realistic interaction. Plot the distribution. Look for
outlier spikes. Watchers should show low variance. Signals may show spikes
on state transitions.

**4. Memory overhead and GC pressure.** Measure heap size after creating N
bindings. Signals maintain a bidirectional subscription graph (more memory).
Watchers are closures with a cached value (less memory). Also measure GC
pause frequency - signal subscription churn can create GC pressure that
causes periodic frame drops.

**5. Scaling with dependency-graph depth.** Create a diamond dependency
pattern (N signals → M derivations → K effects). Measure flush time as
the graph grows. Watchers have no equivalent - their cost is always linear
in the number of watches, regardless of value relationships.

### Real-World Cost Context

For perspective, here are rough estimates at 60fps (16.6ms frame budget):

| Scenario | Events | Signals | Watchers |
|---|---|---|---|
| 50 primitive watches, nothing changes | ~0μs | ~0μs | ~0.25μs |
| 50 primitive watches, all change | ~0μs (no events) | ~5–50μs* | ~0.25μs |
| 50 watches, 5 change | ~0.5μs (5 emits) | ~1–5μs | ~0.25μs |
| 200 watches, nothing changes | ~0μs | ~0μs | ~1μs |
| 200 watches, 50 change | ~5μs (50 emits) | ~20–100μs* | ~1μs |

\*Signal costs vary significantly with implementation and graph topology. These
ranges are illustrative, not measured. Use the benchmarks above to measure your
specific scenario.

The key takeaway: **for primitive-comparison watchers at game-typical scale
(50–200 bindings), the absolute cost is a tiny fraction of the frame budget
regardless of approach.** The decision should be based on correctness,
maintainability, and architectural fit - not performance - unless you are at
extreme scale.

## Correctness Properties

### Consistency (Freedom from Glitches)

A "glitch" is when a computation sees inconsistent state - some values at their
new state, others still at their old state.

- **Events:** Susceptible to glitches. A handler that reads multiple model
  properties during a partially-completed update sees mixed state. Mitigation:
  emit events only after all mutations are complete.

- **Signals:** Glitch-free within a batch, *if* the signal runtime provides
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
  *visible* in testing/gameplay.

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

## Architectural Fit

### Tick-Based Games and Simulations

**Best fit: Watchers**, with events for discrete cross-cutting concerns.

The tick loop provides a natural polling point. Model updates complete before
view refreshes, guaranteeing consistency. Views are often ephemeral (enemies,
particles, effects), making zero-cleanup lifecycle management valuable.

Signals' dependency tracking is largely redundant - the tick already answers
"when to re-evaluate" (every frame). The overhead of the signal runtime
provides no benefit in this context.

Events remain useful for **discrete, one-off occurrences** that don't map to
per-frame state - game over, achievement unlocked, level transition.

**Typical hybrid pattern:**
```
Watchers  → infrequently-changing state (phases, scores, lives)
Direct reads → per-frame state (positions, velocities, timers)
Events    → discrete lifecycle events (game over, level start, achievement)
```

### UI-Driven Web Applications

**Best fit: Signals**, with events for cross-component communication.

UI apps are event-driven (user interactions), not tick-driven. There is no
natural polling point - signals provide the "when to update" answer
automatically. Component rendering models (SolidJS, Angular, Vue) are designed
around signals and re-render only when dependencies change.

Watchers would require introducing a polling loop (`requestAnimationFrame` or
`setInterval`) to check for changes, replicating what signals do automatically
but with constant per-check overhead.

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
modular systems), events provide the loosest coupling. The source defines an
event contract; consumers subscribe to what they need.

Signals require the consumer to access signal instances from the source, which
creates tighter coupling. Watchers require the consumer to access readable
properties - though this coupling can be minimised with a **bindings interface**
pattern: the consumer declares a `Bindings` interface describing only the
properties it needs, and the source provides an object satisfying that interface.
With bindings, the consumer and source can vary independently as long as the
interface contract is met, achieving decoupling comparable to events:

```typescript
// Consumer defines what it needs - doesn't know or care about the source
interface HudBindings {
    getScore(): number;
    getLives(): number;
}

function createHudView(bindings: HudBindings): Container { /* ... */ }
```

## Decision Framework

Use this flowchart to identify the best starting point for your project. These
are strong defaults, not absolute rules - hybrid approaches are common and
often the best answer.

```
Does your application have a tick/frame loop?
├── YES: Is the tick loop the primary driver of view updates?
│   ├── YES → Watchers (for per-frame state)
│   │         + Events (for discrete cross-cutting concerns)
│   └── NO (tick loop exists but UI is primary) → Signals
│         + Watchers (for tick-driven subsystems)
└── NO: Are components loosely coupled / plugin-based?
    ├── YES → Events (for component communication)
    │         + Signals (for component-internal state)
    └── NO → Signals (for state management)
              + Events (for user interactions, external data)
```

### Mixing Approaches

In practice, most non-trivial applications benefit from more than one reactivity
mechanism. The key principle: **choose the approach that fits each subsystem's
update model, not a single global approach.**

| Subsystem | Update model | Good fit |
|---|---|---|
| Game entity positions/state | Per-frame tick | Direct reads (positions) + Watchers (phase changes) |
| Score display, HUD | Per-frame tick | Watchers |
| Sound effects | Discrete events | Events |
| Analytics | Discrete events | Events |
| Level transitions | Discrete state change | Events or Watchers |
| UI settings panel | User-driven interaction | Signals or Events |
| Derived aggregates (leaderboard) | Computed from state | Signals (or model-layer derivation + Watchers) |

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
