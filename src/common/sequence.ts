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

/** Runtime state of a single step, updated each tick. */
export interface StepState {
    /** Name matching the step definition. */
    readonly name: string;
    /** Linear 0..1 progress. 0 before the step starts, 1 after it ends. */
    readonly progress: number;
    /** True while the step is running (0 < progress < 1). */
    readonly active: boolean;
}

/** A pre-allocated, ticker-driven sequence of overlapping timed steps. */
export interface Sequence {
    /** True from `start()` until every step has completed. */
    readonly isRunning: boolean;
    /** Pre-allocated step states in definition order. */
    readonly steps: readonly StepState[];
    /** Total duration in ms (max of startMs + durationMs across all steps). */
    readonly totalMs: number;
    /** Start (or restart) the sequence from t=0. */
    start(): void;
    /** Advance by deltaMs. No-op when not running. */
    update(deltaMs: number): void;
    /** Look up a step by name. Returns the pre-allocated state object. */
    step(name: string): StepState;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Sentinel returned by `step()` for unknown names. Always inactive. */
const EMPTY_STEP: StepState = { name: '', progress: 0, active: false };

export function createSequence(defs: readonly StepDef[]): Sequence {
    const count = defs.length;

    // Pre-compute end times and total duration
    const startsSec: number[] = new Array(count);
    const durationsSec: number[] = new Array(count);
    let totalMs = 0;
    for (let i = 0; i < count; i++) {
        startsSec[i] = defs[i].startMs * 0.001;
        durationsSec[i] = defs[i].durationMs * 0.001;
        const endMs = defs[i].startMs + defs[i].durationMs;
        if (endMs > totalMs) totalMs = endMs;
    }
    const totalSec = totalMs * 0.001;

    // Pre-allocated mutable step state pool
    const pool: { name: string; progress: number; active: boolean }[] = new Array(count);
    for (let i = 0; i < count; i++) {
        pool[i] = { name: defs[i].name, progress: 0, active: false };
    }

    // Name -> index lookup (built once)
    const nameIndex = new Map<string, number>();
    for (let i = 0; i < count; i++) {
        nameIndex.set(defs[i].name, i);
    }

    let elapsedSec = 0;
    let running = false;

    const sequence: Sequence = {
        get isRunning() { return running; },
        steps: pool,
        totalMs,

        start(): void {
            elapsedSec = 0;
            running = true;
            for (let i = 0; i < count; i++) {
                pool[i].progress = 0;
                pool[i].active = false;
            }
        },

        update(deltaMs: number): void {
            if (!running) return;
            elapsedSec += deltaMs * 0.001;

            let anyActive = false;
            for (let i = 0; i < count; i++) {
                const s = startsSec[i];
                const d = durationsSec[i];
                const local = elapsedSec - s;
                if (local <= 0) {
                    pool[i].progress = 0;
                    pool[i].active = false;
                    anyActive = true; // not yet started - sequence still running
                }
                else if (local >= d) {
                    pool[i].progress = 1;
                    pool[i].active = false;
                }
                else {
                    pool[i].progress = local / d;
                    pool[i].active = true;
                    anyActive = true;
                }
            }

            if (elapsedSec >= totalSec) {
                running = false;
            }
            else if (!anyActive) {
                // Edge case: gaps in the sequence (all steps done or not started
                // but total time not reached). Keep running until totalSec.
                running = true;
            }
        },

        step(name: string): StepState {
            const idx = nameIndex.get(name);
            if (idx === undefined) return EMPTY_STEP;
            return pool[idx];
        },
    };

    return sequence;
}
