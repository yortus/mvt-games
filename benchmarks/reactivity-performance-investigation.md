# Reactivity Performance Investigation

## Purpose

The reactivity guide makes qualitative claims about the relative performance of
events, signals, and watchers. This investigation provides empirical benchmarks
to check whether those claims hold up.

## Benchmark Suites

- `reactivity-simple.bench.ts` - a single game entity with 3 per-tick mutations
  and 1 infrequent discrete change. Simple, focused, easy to reason about.
- `reactivity.bench.ts` - scaling scenarios: typical ticks, state changes,
  polling overhead, diamond dependency graphs, and simulated game sessions.

Run with `npm run bench`.

Events and watchers use the hybrid pattern described in the guide: the reactive
mechanism (event emission or watcher polling) handles infrequent discrete
changes, while per-tick state is read directly. Signals wrap all state in
signals, as the signal model requires.

## SolidJS SSR vs Client Runtime

Vitest resolves `solid-js` to the SSR build by default (Node.js export
condition) where `createEffect`, `createMemo`, and `batch` are inert stubs.
Signal writes and reads still work (they're closures around a variable), but no
reactive propagation occurs - no dependency tracking, no effect re-execution, no
batching coordination. This silently produces misleadingly fast signal results.

An alias in `vite.config.ts` redirects `solid-js` imports to the client runtime:

```typescript
test: {
    alias: {
        'solid-js': resolve(__dirname, 'node_modules/solid-js/dist/solid.js'),
    },
},
```

## Results

### Simple benchmark (1 entity, 3 per-tick + 1 infrequent)

| Approach | ops/sec | Relative |
|----------|---------|----------|
| events | 12.7M | 1.0x (fastest) |
| watchers | 10.8M | 1.18x slower |
| signals | 3.4M | 3.74x slower |

### Scaling benchmarks (typical game tick, per-tick state only)

| Scale | Events | Watchers | Signals | Signals vs Events |
|-------|--------|----------|---------|-------------------|
| 50 values (10 watched, 40 direct) | 3.6M | 2.5M | 291K | **12x slower** |
| 100 values (20 watched, 80 direct) | 1.9M | 1.3M | 124K | **16x slower** |
| 200 values (40 watched, 160 direct) | 1.0M | 675K | 55K | **19x slower** |

Events are 1.4-1.5x faster than watchers across all scales. Watchers poll all
watched values every tick even when nothing changed; events have zero
idle-tick cost.

### Diamond dependency graphs

| Width | Watchers | Signals | Signals vs Watchers |
|-------|----------|---------|---------------------|
| 8 | 9.97M | 795K | **12.5x slower** |
| 16 | 8.08M | 387K | **20.9x slower** |
| 32 | 6.48M | 190K | **34.0x slower** |
| 64 | 5.05M | 84K | **60.3x slower** |

### Session simulation (600 ticks, 100 values, 10% change rate)

| Approach | ops/sec | Relative |
|----------|---------|----------|
| events + direct reads | 4,107 | 1.0x (fastest) |
| watchers + direct reads | 2,815 | 1.5x slower |
| signals (all state in signals) | 211 | **19x slower** |

## Analysis

### Why signals are slower

Each signal read inside a reactive context performs bookkeeping: checking the
tracking context, registering dependencies in Sets, registering subscribers.
Each signal write marks dependents dirty and (at batch end) schedules and
executes effect re-runs in topological order.

At small scale (4 values, 1 entity), this overhead makes signals ~3.5x slower
than events. At game scale (50-200 values), the ratio grows to 12-19x because:

1. **Signals wrap all state.** Per-tick values (positions, velocities) must be
   signals too, so they trigger reactive propagation every frame. Events and
   watchers read per-tick values directly with zero reactive overhead.

2. **Dependency graph overhead scales.** More signals means more Set operations,
   more subscriber bookkeeping, more topological sorting work per batch flush.
   Diamond graphs make this worse (up to 60x) because intermediate memo layers
   multiply the propagation cost.

3. **Watcher polling is cheap.** A watcher poll is: call getter, compare to
   cached value, conditionally update. This is simple, branch-predictor-friendly
   work with no heap allocations.

### Why events are faster than watchers

Both use the same hybrid pattern: the reactive mechanism handles infrequent
discrete changes while per-tick state is read directly. The difference is what
happens on idle ticks (the ~90% of ticks where no discrete change occurs):

- **Events**: zero cost. No handlers fire, no comparisons run.
- **Watchers**: poll every watched value, comparing against cached values, even
  when nothing has changed.

This polling overhead grows linearly with the number of watched values. With 50
watched values, watchers spend ~0.6us per tick on comparisons that detect no
change.

### Absolute costs in context

At 200 values, events cost ~1.0us per tick and watchers ~1.5us - both well
under 0.01% of the 16.6ms frame budget. Signals at 200 values cost ~18us =
0.1% of frame budget. All three approaches are negligible at game-typical scale.

The relative differences become relevant at extreme scale (hundreds of
signal-wrapped values, deep dependency graphs) or in performance-critical inner
loops.

## How Results Relate to Guide Claims

### Confirmed

- Watchers have a constant cost every tick proportional to watched values
- Signals and events are free when idle
- At game-typical scale, reactive overhead is a negligible fraction of frame
  budget for all approaches
- Signals have per-read overhead for dependency tracking (9-12x slower than
  watchers, up to 60x for diamond graphs)
- The hybrid pattern (watch/emit infrequent state, read per-tick state directly)
  is a key performance advantage of events and watchers over signals

### Additional findings

- Events are 1.3-1.5x faster than watchers when both use the hybrid pattern,
  due to watchers' polling overhead on idle ticks
- Signal overhead grows non-linearly with dependency graph depth (12x at diamond
  width 8, 60x at width 64)
