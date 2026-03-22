//
// Reactivity Approach Benchmarks
//
//
// Quantitative comparison of events, signals, and watchers across scenarios
// from docs/reactivity-guide/comparison.md.
//
// Run all:        npm run bench
// Filter:         npx vitest bench --filter "100 values"
//
// Interpreting results:
//   ops/sec   = how many ticks per second this approach can sustain
//   mean (ns) = average time per tick
//   Frame budget: 16,667�s at 60fps. Divide mean(�s) by 16,667 for % budget.
//
//

import { bench, describe } from 'vitest';
import {
    createSignal,
    createEffect,
    createRoot,
    createMemo,
    batch,
} from 'solid-js';

//
// Sink - prevents dead-code elimination
//

let sinkSum = 0;

/** Read after benchmarks to prevent DCE of sinkSum writes. */
export function getSink(): number {
    return sinkSum;
}

//
// Watch implementation (inlined from src/common/watch.ts)
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

function createWatcherHarness(n: number) {
    const values = new Float64Array(n);
    const getters: (() => number)[] = new Array(n);
    for (let i = 0; i < n; i++) {
        const idx = i;
        getters[idx] = () => values[idx];
    }

    const watcher = watch(getters);

    // Initial poll so first benchmark tick is a steady-state poll
    watcher.poll();

    return {
        mutate(k: number) {
            for (let i = 0; i < k; i++) values[i]++;
        },
        tick() {
            const state = watcher.poll();
            for (let i = 0; i < state.length; i++) {
                if (state[i].changed) {
                    sinkSum += state[i].value as number;
                }
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

function createEventHarness(n: number) {
    const values = new Float64Array(n);
    const emitters: ReturnType<typeof createEmitter>[] = new Array(n);

    for (let i = 0; i < n; i++) {
        emitters[i] = createEmitter();
        emitters[i].on((value: number) => {
            sinkSum += value;
        });
    }

    return {
        mutateAndTick(k: number) {
            for (let i = 0; i < k; i++) {
                values[i]++;
                emitters[i].emit(values[i]);
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
// 1. Idle tick (nothing changes)
//
// Watchers poll every tick regardless of changes. Signals and events do
// nothing when idle. This group quantifies the watcher floor cost.
// ---------------------------------------------------------------------------

for (const n of [50, 100, 200]) {
    describe(`idle tick (nothing changes) - ${n} bindings`, () => {
        const w = createWatcherHarness(n);

        bench('watchers', () => {
            w.tick();
        });

        // Signals and events have zero reactive overhead when idle.
        // Include a noop to show the measurement floor.
        bench('signals/events (idle - zero cost)', () => {
            sinkSum++;
        });
    });
}

// ---------------------------------------------------------------------------
// 2. All values change
//
// Every binding's value changes before the tick. Measures the full cost of
// mutation + propagation + reaction for each approach.
// ---------------------------------------------------------------------------

for (const n of [50, 100, 200]) {
    describe(`all-change tick - ${n} bindings`, () => {
        const w = createWatcherHarness(n);
        const s = createSignalHarness(n);
        const e = createEventHarness(n);

        bench('watchers', () => {
            w.mutate(n);
            w.tick();
        });

        bench('signals (batched)', () => {
            s.mutateAndTick(n);
        });

        bench('events', () => {
            e.mutateAndTick(n);
        });
    });
}

// ---------------------------------------------------------------------------
// 3. Partial change (K of N change)
//
// Only a fraction of values change - a realistic game scenario where most
// state is stable on any given tick.
// ---------------------------------------------------------------------------

for (const [n, k] of [
    [100, 5],
    [100, 25],
    [200, 10],
    [200, 50],
] as const) {
    describe(`partial change - ${k} of ${n} change`, () => {
        const w = createWatcherHarness(n);
        const s = createSignalHarness(n);
        const e = createEventHarness(n);

        bench('watchers', () => {
            w.mutate(k);
            w.tick();
        });

        bench('signals (batched)', () => {
            s.mutateAndTick(k);
        });

        bench('events', () => {
            e.mutateAndTick(k);
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
// Simulates 600 ticks (~10 seconds at 60fps) with a realistic change
// pattern: most ticks are idle, occasional bursts of changes.
//
// Change schedule:
//   - 90% of ticks: nothing changes
//   - 10% of ticks: 5 values change
// ---------------------------------------------------------------------------

const SESSION_TICKS = 600;
const SESSION_N = 100;
const SESSION_CHANGE_TICKS = 60; // 10% of 600
const SESSION_K = 5;

// Pre-generate a deterministic schedule: which ticks have changes
const changeSchedule = new Uint8Array(SESSION_TICKS);
{
    // Evenly space change ticks for reproducibility
    const gap = Math.floor(SESSION_TICKS / SESSION_CHANGE_TICKS);
    for (let i = 0; i < SESSION_CHANGE_TICKS; i++) {
        changeSchedule[i * gap] = 1;
    }
}

describe(`session simulation - ${SESSION_TICKS} ticks, ${SESSION_N} bindings, ${SESSION_CHANGE_TICKS} change ticks`, () => {
    // Pre-create all infrastructure so bench measures only per-session tick cost.

    // --- Watcher infrastructure ---
    const wValues = new Float64Array(SESSION_N);
    const wGetters: (() => number)[] = new Array(SESSION_N);
    for (let i = 0; i < SESSION_N; i++) {
        const idx = i;
        wGetters[idx] = () => wValues[idx];
    }
    const wWatcher = watch(wGetters);
    const wState = wWatcher.poll();

    // --- Signal infrastructure ---
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
        // Root stays alive for the lifetime of the benchmark suite.
        // In a real app, signals live for the component's lifetime.
    });

    // --- Event infrastructure ---
    const eValues = new Float64Array(SESSION_N);
    const eEmitters: ReturnType<typeof createEmitter>[] = new Array(SESSION_N);
    for (let i = 0; i < SESSION_N; i++) {
        eEmitters[i] = createEmitter();
        eEmitters[i].on((value: number) => {
            sinkSum += value;
        });
    }

    bench('watchers', () => {
        for (let t = 0; t < SESSION_TICKS; t++) {
            if (changeSchedule[t]) {
                for (let i = 0; i < SESSION_K; i++) wValues[i]++;
            }
            wWatcher.poll();
            for (let i = 0; i < wState.length; i++) {
                if (wState[i].changed) sinkSum += wState[i].value as number;
            }
        }
    });

    bench('signals (batched)', () => {
        for (let t = 0; t < SESSION_TICKS; t++) {
            if (changeSchedule[t]) {
                sCounter++;
                batch(() => {
                    for (let i = 0; i < SESSION_K; i++) {
                        sSetters[i](sCounter * SESSION_N + i);
                    }
                });
            }
            // When nothing changes, signals do zero work - no poll needed
        }
    });

    bench('events', () => {
        for (let t = 0; t < SESSION_TICKS; t++) {
            if (changeSchedule[t]) {
                for (let i = 0; i < SESSION_K; i++) {
                    eValues[i]++;
                    eEmitters[i].emit(eValues[i]);
                }
            }
        }
    });
});
