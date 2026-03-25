//
// Reactivity Approach Benchmarks
//
//
// Quantitative comparison of events, signals, and watchers across scenarios
// from docs/reactivity-guide/comparison.md.
//
// Key insight from the guide: in tick-based games, watchers are used only for
// infrequently-changing state (phases, scores, lives). Per-tick state
// (positions, velocities, timers) is read directly every frame with no
// reactive mechanism.
//
// Run all:        npm run bench
// Filter:         npx vitest bench --filter "typical tick"
//
// Interpreting results:
//   ops/sec   = how many ticks per second this approach can sustain
//   mean (ns) = average time per tick
//   Frame budget: 16,667us at 60fps. Divide mean(us) by 16,667 for % budget.
//
//

import { bench, describe } from 'vitest';
// NB: Vitest resolves solid-js to the SSR build by default (Node export
// condition) where effects and memos are inert. The test alias in
// vite.config.ts redirects to the client runtime so reactive propagation
// works the same way it does in a browser.
import { createSignal, createEffect, createRoot, createMemo, batch } from 'solid-js';

//
// Sink - prevents dead-code elimination
//

let sinkSum = 0;

/** Read after benchmarks to prevent DCE of sinkSum writes. */
export function getSink(): number {
    return sinkSum;
}

//
// Watch implementation (array-based variant for benchmarking)
//
// The real watch() from src/common uses a named-record API for ergonomics.
// This array-based variant enables scaling to N dynamically-created values
// with efficient index-based iteration. The core comparison logic is the same.
//

interface WatchState {
    changed: boolean;
    value: unknown;
    previous: unknown;
}

function watch(getters: (() => number)[]) {
    const n = getters.length;
    const state: WatchState[] = new Array(n);
    for (let i = 0; i < n; i++) {
        state[i] = { changed: false, value: undefined, previous: undefined };
    }

    return {
        poll() {
            for (let i = 0; i < n; i++) {
                const next = getters[i]();
                const s = state[i];
                s.previous = s.value;
                s.changed = next !== s.value;
                if (s.changed) s.value = next;
            }
            return state;
        },
    };
}

//
// Typed event emitter (minimal, from the guide)
//

function createEmitter() {
    const handlers: ((value: number) => void)[] = [];
    return {
        on(handler: (value: number) => void) {
            handlers.push(handler);
        },
        emit(value: number) {
            for (let i = 0; i < handlers.length; i++) {
                handlers[i](value);
            }
        },
    };
}

//
// Harness factories
//
// The three approaches have fundamentally different scoping:
//
//   Watchers: only infrequently-changing state is watched (phases, scores,
//     lives). Per-tick state (positions, velocities) is read directly with
//     no reactive overhead. This is the hybrid pattern from the guide.
//
//   Signals: ALL model state must be wrapped in signals - the reactive
//     system can only track signal reads, so per-tick values like positions
//     must also be signals. Every write triggers dependency tracking.
//
//   Events: like watchers, events use a hybrid pattern. Infrequently-
//     changing state emits events; per-tick state is read directly.
//
// Watcher harness: nWatched values through watchers, nDirect direct reads.
// Event harness:   nEmitted values through emitters, nDirect direct reads.
// Signal harness:  all n values through signals (no hybrid possible).
//

function createWatcherHarness(nWatched: number, nDirect: number) {
    const watchedValues = new Float64Array(nWatched);
    const directValues = new Float64Array(nDirect);

    const getters: (() => number)[] = new Array(nWatched);
    for (let i = 0; i < nWatched; i++) {
        const idx = i;
        getters[idx] = () => watchedValues[idx];
    }

    const watcher = watch(getters);
    watcher.poll(); // initial poll

    return {
        mutateWatched(k: number) {
            for (let i = 0; i < k; i++) watchedValues[i]++;
        },
        advanceDirect() {
            for (let i = 0; i < nDirect; i++) directValues[i]++;
        },
        tick() {
            // Poll watched (infrequent) values
            const state = watcher.poll();
            for (let i = 0; i < state.length; i++) {
                if (state[i].changed) sinkSum += state[i].value as number;
            }
            // Read per-tick values directly (positions, velocities, etc.)
            for (let i = 0; i < nDirect; i++) {
                sinkSum += directValues[i];
            }
        },
    };
}

function createSignalHarness(n: number) {
    const setters: ((v: number) => void)[] = new Array(n);
    let counter = 0;

    const disposeFn = createRoot((dispose) => {
        for (let i = 0; i < n; i++) {
            const [get, set] = createSignal(0);
            setters[i] = (v: number) => set(v);

            // Each signal has one effect (simulates one view binding)
            createEffect(() => {
                sinkSum += get();
            });
        }
        return dispose;
    });

    return {
        /** Write to k signals (triggers effects via batch). */
        mutateAndTick(k: number) {
            counter++;
            batch(() => {
                for (let i = 0; i < k; i++) {
                    setters[i](counter * n + i);
                }
            });
        },
        dispose() {
            disposeFn?.();
        },
    };
}

function createEventHarness(nEmitted: number, nDirect: number) {
    const emittedValues = new Float64Array(nEmitted);
    const directValues = new Float64Array(nDirect);
    const emitters: ReturnType<typeof createEmitter>[] = new Array(nEmitted);

    for (let i = 0; i < nEmitted; i++) {
        emitters[i] = createEmitter();
        emitters[i].on((value: number) => {
            sinkSum += value;
        });
    }

    return {
        /** Emit for k of the nEmitted infrequent values. */
        mutateEmitted(k: number) {
            for (let i = 0; i < k; i++) {
                emittedValues[i]++;
                emitters[i].emit(emittedValues[i]);
            }
        },
        /** Advance per-tick values (no reactive overhead). */
        advanceDirect() {
            for (let i = 0; i < nDirect; i++) directValues[i]++;
        },
        /** Read per-tick values directly (same as watcher tick). */
        tick() {
            for (let i = 0; i < nDirect; i++) {
                sinkSum += directValues[i];
            }
        },
    };
}

//
// Diamond dependency graph harnesses (signals + watchers)
//

/**
 * Create a layered diamond graph with `width` sources at the bottom,
 * halving at each layer until a single derived value feeds one effect.
 *
 * Example with width=8, depth=3:
 *   Layer 0: 8 source signals
 *   Layer 1: 4 memos (pairs summed)
 *   Layer 2: 2 memos (pairs summed)
 *   Layer 3: 1 memo  (pair summed)
 *   Effect:  reads the final memo
 */
function createDiamondSignalHarness(width: number) {
    const setters: ((v: number) => void)[] = new Array(width);
    let counter = 0;

    const disposeFn = createRoot((dispose) => {
        // Source layer
        const layer: (() => number)[] = new Array(width);
        for (let i = 0; i < width; i++) {
            const [get, set] = createSignal(0);
            layer[i] = get;
            setters[i] = (v: number) => set(v);
        }

        // Derived layers - halve width at each level
        let current = layer;
        while (current.length > 1) {
            const next: (() => number)[] = [];
            for (let i = 0; i < current.length; i += 2) {
                if (i + 1 < current.length) {
                    const a = current[i];
                    const b = current[i + 1];
                    next.push(createMemo(() => a() + b()));
                }
                else {
                    next.push(current[i]);
                }
            }
            current = next;
        }

        // Final effect
        const top = current[0];
        createEffect(() => {
            sinkSum += top();
        });

        return dispose;
    });

    return {
        mutateAll() {
            counter++;
            batch(() => {
                for (let i = 0; i < width; i++) {
                    setters[i](counter * width + i);
                }
            });
        },
        dispose() {
            disposeFn?.();
        },
    };
}

/**
 * Watcher equivalent of the diamond graph: a single watcher that evaluates
 * a getter performing the same arithmetic (sum all source values through a
 * reduction tree). The watcher has no graph concept - just one getter that
 * reads all sources.
 */
function createDiamondWatcherHarness(width: number) {
    const values = new Float64Array(width);

    // Single getter that sums all values (same computation as the diamond)
    const watcher = watch([
        () => {
            let sum = 0;
            for (let i = 0; i < width; i++) sum += values[i];
            return sum;
        },
    ]);
    watcher.poll(); // initial poll

    return {
        mutateAll() {
            for (let i = 0; i < width; i++) values[i]++;
        },
        tick() {
            const state = watcher.poll();
            if (state[0].changed) sinkSum += state[0].value as number;
        },
    };
}

//
//
// BENCHMARKS
//
//

// ---------------------------------------------------------------------------
// 1. Typical game tick - per-tick state only (no infrequent changes)
//
// Every tick, per-tick values (positions, velocities) change.
// Infrequent values (scores, phases, lives) don't change on this tick.
//
// Watchers: poll the watched subset (no changes found) + direct-read
//   per-tick values. Reactive cost = polling nWatched unchanged getters.
// Signals: ALL n values are signals. Per-tick signals write + fire effects
//   every tick. Reactive cost = n signal writes + n effect re-runs.
// Events: no emissions this tick (nothing infrequent changed) + direct-read
//   per-tick values. Reactive cost = zero.
// ---------------------------------------------------------------------------

for (const [n, nWatched, nDirect] of [
    [50, 10, 40],
    [100, 20, 80],
    [200, 40, 160],
] as const) {
    describe(`typical tick (per-tick only) - ${n} values (${nWatched} watched, ${nDirect} direct)`, () => {
        const w = createWatcherHarness(nWatched, nDirect);
        const s = createSignalHarness(n);
        const e = createEventHarness(nWatched, nDirect);

        bench('watchers + direct reads', () => {
            w.advanceDirect();
            w.tick();
        });

        bench('signals (all values are signals)', () => {
            // Per-tick values change via signal writes every tick
            s.mutateAndTick(nDirect);
        });

        bench('events + direct reads', () => {
            // No emissions (nothing infrequent changed), just direct reads
            e.advanceDirect();
            e.tick();
        });
    });
}

// ---------------------------------------------------------------------------
// 2. Tick with additional state changes
//
// Same as above, but K infrequent values also change (score update, phase
// transition, etc.). Total per-tick reactive work:
//
// Watchers: poll nWatched (K changed) + direct-read nDirect
// Signals: write nDirect + K signals, fire nDirect + K effects
// Events: emit K times + direct-read nDirect
// ---------------------------------------------------------------------------

for (const [n, nWatched, nDirect, k] of [
    [100, 20, 80, 2],    // 2 state changes (e.g., score + combo)
    [100, 20, 80, 10],   // 10 state changes (multiple entities change phase)
    [200, 40, 160, 5],   // larger game, some state changes
    [200, 40, 160, 20],  // larger game, many state changes
] as const) {
    describe(`tick with ${k} state changes - ${n} values (${nWatched} watched, ${nDirect} direct)`, () => {
        const w = createWatcherHarness(nWatched, nDirect);
        const s = createSignalHarness(n);
        const e = createEventHarness(nWatched, nDirect);

        bench('watchers + direct reads', () => {
            w.mutateWatched(k);
            w.advanceDirect();
            w.tick();
        });

        bench('signals (all values are signals)', () => {
            // Per-tick signals + K infrequent signals all fire
            s.mutateAndTick(nDirect + k);
        });

        bench('events + direct reads', () => {
            // K infrequent emitters fire + direct-read per-tick values
            e.mutateEmitted(k);
            e.advanceDirect();
            e.tick();
        });
    });
}

// ---------------------------------------------------------------------------
// 3. Watcher polling overhead (mechanism isolation)
//
// Pure watcher overhead with no direct reads, for different counts of
// watched values. Signals and events have zero cost when idle, so this
// isolates the watcher-specific floor cost.
//
// Uses realistic reactive-value counts (10-50), not total binding counts,
// since only infrequently-changing values are watched.
// ---------------------------------------------------------------------------

for (const n of [10, 20, 50]) {
    describe(`watcher polling overhead - ${n} watched values (nothing changes)`, () => {
        const w = createWatcherHarness(n, 0);

        bench('watchers (poll, no changes)', () => {
            w.tick();
        });

        bench('signals/events (idle - zero cost)', () => {
            sinkSum++;
        });
    });
}

// ---------------------------------------------------------------------------
// 4. Diamond dependency graph
//
// Signals: layered diamond (width sources -> memos -> single effect).
// Watchers: flat getter computing the same aggregate.
// Tests how each approach handles derived/aggregate state.
// ---------------------------------------------------------------------------

for (const width of [8, 16, 32, 64]) {
    describe(`diamond graph - width ${width}`, () => {
        const dw = createDiamondWatcherHarness(width);
        const ds = createDiamondSignalHarness(width);

        bench('watchers (flat aggregate getter)', () => {
            dw.mutateAll();
            dw.tick();
        });

        bench('signals (layered diamond)', () => {
            ds.mutateAll();
        });
    });
}

// ---------------------------------------------------------------------------
// 5. Realistic session simulation
//
// Simulates 600 ticks (~10 seconds at 60fps).
//   - 100 total values: 20 infrequent (score, phase, etc.) + 80 per-tick
//   - Per-tick values change every tick (positions move)
//   - 10% of ticks: 3 infrequent values also change
//
// Watchers: watch 20 infrequent values + direct-read 80 per-tick values.
// Signals: all 100 values are signals. 80 write every tick + 3 more on
//   change ticks. All writes trigger effects.
// Events: 20 emitters for infrequent values + direct-read 80 per-tick
//   values. On change ticks, 3 emitters fire.
// ---------------------------------------------------------------------------

const SESSION_TICKS = 600;
const SESSION_N = 100;
const SESSION_N_WATCHED = 20;
const SESSION_N_DIRECT = 80;
const SESSION_CHANGE_TICKS = 60; // 10% of 600
const SESSION_K = 3;

// Pre-generate a deterministic schedule: which ticks have infrequent changes
const changeSchedule = new Uint8Array(SESSION_TICKS);
{
    const gap = Math.floor(SESSION_TICKS / SESSION_CHANGE_TICKS);
    for (let i = 0; i < SESSION_CHANGE_TICKS; i++) {
        changeSchedule[i * gap] = 1;
    }
}

describe(`session simulation - ${SESSION_TICKS} ticks, ${SESSION_N} values (${SESSION_N_WATCHED} watched, ${SESSION_N_DIRECT} direct), ${SESSION_CHANGE_TICKS} state-change ticks`, () => {
    // --- Watcher infrastructure (20 watched + 80 direct) ---
    const wWatchedValues = new Float64Array(SESSION_N_WATCHED);
    const wDirectValues = new Float64Array(SESSION_N_DIRECT);
    const wGetters: (() => number)[] = new Array(SESSION_N_WATCHED);
    for (let i = 0; i < SESSION_N_WATCHED; i++) {
        const idx = i;
        wGetters[idx] = () => wWatchedValues[idx];
    }
    const wWatcher = watch(wGetters);
    const wState = wWatcher.poll();

    // --- Signal infrastructure (all 100 are signals) ---
    const sSetters: ((v: number) => void)[] = new Array(SESSION_N);
    let sCounter = 0;
    createRoot((_dispose) => {
        for (let i = 0; i < SESSION_N; i++) {
            const [get, set] = createSignal(0);
            sSetters[i] = (v: number) => set(v);
            createEffect(() => {
                sinkSum += get();
            });
        }
    });

    // --- Event infrastructure (20 emitters for infrequent + 80 direct) ---
    const eEmittedValues = new Float64Array(SESSION_N_WATCHED);
    const eDirectValues = new Float64Array(SESSION_N_DIRECT);
    const eEmitters: ReturnType<typeof createEmitter>[] = new Array(SESSION_N_WATCHED);
    for (let i = 0; i < SESSION_N_WATCHED; i++) {
        eEmitters[i] = createEmitter();
        eEmitters[i].on((value: number) => {
            sinkSum += value;
        });
    }

    bench('watchers + direct reads', () => {
        for (let t = 0; t < SESSION_TICKS; t++) {
            // Infrequent state changes
            if (changeSchedule[t]) {
                for (let i = 0; i < SESSION_K; i++) wWatchedValues[i]++;
            }
            // Per-tick state changes (direct, no reactive overhead)
            for (let i = 0; i < SESSION_N_DIRECT; i++) wDirectValues[i]++;

            // Tick: poll watched subset + read direct values
            wWatcher.poll();
            for (let i = 0; i < wState.length; i++) {
                if (wState[i].changed) sinkSum += wState[i].value as number;
            }
            for (let i = 0; i < SESSION_N_DIRECT; i++) {
                sinkSum += wDirectValues[i];
            }
        }
    });

    bench('signals (all state in signals)', () => {
        for (let t = 0; t < SESSION_TICKS; t++) {
            sCounter++;
            // Per-tick signals write every tick (positions etc.)
            // + infrequent signals on change ticks
            const nWrites = changeSchedule[t] ?
                SESSION_N_DIRECT + SESSION_K :
                SESSION_N_DIRECT;
            batch(() => {
                for (let i = 0; i < nWrites; i++) {
                    sSetters[i](sCounter * SESSION_N + i);
                }
            });
        }
    });

    bench('events + direct reads', () => {
        for (let t = 0; t < SESSION_TICKS; t++) {
            // Infrequent state changes - emit events
            if (changeSchedule[t]) {
                for (let i = 0; i < SESSION_K; i++) {
                    eEmittedValues[i]++;
                    eEmitters[i].emit(eEmittedValues[i]);
                }
            }
            // Per-tick state changes (direct, no reactive overhead)
            for (let i = 0; i < SESSION_N_DIRECT; i++) eDirectValues[i]++;

            // Read per-tick values directly
            for (let i = 0; i < SESSION_N_DIRECT; i++) {
                sinkSum += eDirectValues[i];
            }
        }
    });
});
