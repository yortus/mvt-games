// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Static definition of a single step within a sequence. */
export interface StepDef {
    readonly name: string;
    /** Delay in ms from the start of the sequence. */
    readonly startMs: number;
    /** Duration in ms. Must be > 0. */
    readonly durationMs: number;
}

/** A pre-allocated, ticker-driven sequence of overlapping timed steps. */
export interface Sequence<N extends string = string> {
    /** Total duration in ms (max of startMs + durationMs across all steps). */
    readonly durationMs: number;
    /** True from `start()` until every step has completed. */
    readonly isActive: boolean;
    /** Linear 0..1 overall progress through the sequence. */
    readonly progress: number;
    /** Named step lookup. Each property has its own `isActive` and `progress`. */
    readonly steps: { readonly [K in N]: { readonly isActive: boolean; readonly progress: number } };
    /** Start (or restart) the sequence from t=0. */
    start(): void;
    /** Advance by deltaMs. No-op when not active. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSequence<const D extends readonly StepDef[]>(defs: D): Sequence<D[number]['name']> {
    const count = defs.length;

    // Pre-compute end times and total duration
    const startsSec: number[] = new Array(count);
    const durationsSec: number[] = new Array(count);
    let durationMs = 0;
    for (let i = 0; i < count; i++) {
        startsSec[i] = defs[i].startMs * 0.001;
        durationsSec[i] = defs[i].durationMs * 0.001;
        const endMs = defs[i].startMs + defs[i].durationMs;
        if (endMs > durationMs) durationMs = endMs;
    }
    const totalSec = durationMs * 0.001;

    // Pre-allocated mutable step state pool
    const pool: { isActive: boolean; progress: number }[] = new Array(count);
    for (let i = 0; i < count; i++) {
        pool[i] = { progress: 0, isActive: false };
    }

    // Named step record (built once - property access is cheaper than Map lookup)
    const stepRecord: Record<string, { isActive: boolean; progress: number }> = {};
    for (let i = 0; i < count; i++) {
        stepRecord[defs[i].name] = pool[i];
    }

    let elapsedSec = 0;
    let active = false;

    const sequence: Sequence<D[number]['name']> = {
        durationMs,
        get isActive() { return active; },
        get progress() {
            if (totalSec <= 0) return 0;
            const p = elapsedSec / totalSec;
            return p > 1 ? 1 : p;
        },
        steps: stepRecord as Sequence<D[number]['name']>['steps'],

        start(): void {
            elapsedSec = 0;
            active = true;
            for (let i = 0; i < count; i++) {
                pool[i].progress = 0;
                pool[i].isActive = false;
            }
        },

        update(deltaMs: number): void {
            if (!active) return;
            elapsedSec += deltaMs * 0.001;

            let anyActive = false;
            for (let i = 0; i < count; i++) {
                const s = startsSec[i];
                const d = durationsSec[i];
                const local = elapsedSec - s;
                if (local <= 0) {
                    pool[i].progress = 0;
                    pool[i].isActive = false;
                    anyActive = true; // not yet started - sequence still running
                }
                else if (local >= d) {
                    pool[i].progress = 1;
                    pool[i].isActive = false;
                }
                else {
                    pool[i].progress = local / d;
                    pool[i].isActive = true;
                    anyActive = true;
                }
            }

            if (elapsedSec >= totalSec) {
                active = false;
            }
            else if (!anyActive) {
                // Edge case: gaps in the sequence (all steps done or not started
                // but total time not reached). Keep running until totalSec.
                active = true;
            }
        },
    };

    return sequence;
}
