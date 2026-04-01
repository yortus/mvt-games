import type { Sequence } from './sequence';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Handlers for a single step's lifecycle.
 *
 * A step has three phases, derived purely from its current state:
 * - **before**: `progress === 0` and not active (step has not yet started)
 * - **active**: step is currently running (`isActive` is true)
 * - **after**: `progress > 0` and not active (step has completed)
 *
 * `inactive` covers both rest states. It receives a boolean `isAfter`
 * argument: `false` when before the step, `true` when after. Most
 * handlers ignore this argument (same reset either side).
 *
 * `starting` and `ending` fire once on the frame the phase transitions
 * into or out of `active`, for one-shot setup/teardown.
 *
 * Phase is re-derived from step state every frame, so the reaction is
 * correct regardless of whether model time moves smoothly, jumps, or
 * flows backward.
 */
export interface StepHandlers {
    /** Rest-state callback. `isAfter` is false before the step, true after it. */
    inactive?: (isAfter: boolean) => void;
    /** One-shot setup on the frame the step becomes active. */
    starting?: () => void;
    /** Called every frame while the step is active. */
    active?: (progress: number) => void;
    /** One-shot teardown on the frame the step leaves active. */
    ending?: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// Phase constants (cheaper comparison than strings on the hot path)
const BEFORE = 0;
const ACTIVE = 1;
const AFTER = 2;

/**
 * Creates a ticker-driven dispatcher that routes each sequence step
 * through inactive/starting/active/ending lifecycle callbacks.
 *
 * Phase is derived purely from step state every frame:
 * - `isActive`       -> ACTIVE
 * - `progress <= 0`  -> BEFORE
 * - otherwise        -> AFTER
 *
 * Callbacks fire on phase transitions and during the active phase.
 *
 * Call the returned function inside `refresh()`.
 */
export function createSequenceReaction<N extends string>(
    sequence: Sequence<N>,
    handlers: { [K in N]?: StepHandlers },
): () => void {
    const keys = Object.keys(handlers) as N[];
    const count = keys.length;

    // Pre-extract step references and handlers for hot-path iteration
    const stepRefs: { readonly isActive: boolean; readonly progress: number }[] = new Array(count);
    const inactives: (((isAfter: boolean) => void) | undefined)[] = new Array(count);
    const startings: ((() => void) | undefined)[] = new Array(count);
    const actives: (((progress: number) => void) | undefined)[] = new Array(count);
    const endings: ((() => void) | undefined)[] = new Array(count);

    // Per-step phase tracking for transition detection
    const prevPhase: number[] = new Array(count);

    for (let i = 0; i < count; i++) {
        stepRefs[i] = sequence.steps[keys[i]];
        const r = handlers[keys[i]]!;
        inactives[i] = r.inactive;
        startings[i] = r.starting;
        actives[i] = r.active;
        endings[i] = r.ending;
    }

    // Initialise: derive phase from current state, fire the matching callback
    for (let i = 0; i < count; i++) {
        const step = stepRefs[i];
        const phase = step.isActive ? ACTIVE : step.progress <= 0 ? BEFORE : AFTER;
        prevPhase[i] = phase;
        firePhaseEntry(i, phase);
    }

    return function update(): void {
        for (let i = 0; i < count; i++) {
            const step = stepRefs[i];
            const phase = step.isActive ? ACTIVE : step.progress <= 0 ? BEFORE : AFTER;
            const prev = prevPhase[i];

            if (phase !== prev) {
                prevPhase[i] = phase;

                // Leaving active: fire ending before entering the new phase
                if (prev === ACTIVE) {
                    endings[i]?.();
                }

                firePhaseEntry(i, phase);
            }
            else if (phase === ACTIVE) {
                // Same phase, still active: dispatch progress
                actives[i]?.(stepRefs[i].progress);
            }
            // Same phase, before or after: no-op (rest state already set)
        }
    };

    function firePhaseEntry(i: number, phase: number): void {
        if (phase === ACTIVE) {
            startings[i]?.();
            actives[i]?.(stepRefs[i].progress);
        }
        else {
            inactives[i]?.(phase === AFTER);
        }
    }
}
