import type { Sequence } from './sequence';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Handlers for a single step's lifecycle phases.
 *
 * A step has two phases derived purely from its current state each frame:
 * - **active**: the step is currently running (`isActive` is true)
 * - **inactive**: the step is at rest (before it starts, or after it completes)
 *
 * `inactive` fires once when the step enters a rest state - on initialization,
 * on active-to-rest transitions, and on rest-to-rest skips (e.g. sequence restart).
 * `entering` fires once on the frame the step becomes active.
 * `active` fires every frame while the step is running.
 *
 * Both `inactive` and `entering` receive an `at` parameter indicating which end
 * of the step the transition occurs at: `'start'` (progress=0 side) or
 * `'end'` (progress=1 side). This is direction-neutral - if time flows
 * backward, a step is entered at `'end'` and becomes inactive at `'start'`.
 */
export interface StepHandlers {
    /** Rest state. `at` is `'start'` before the step, `'end'` after it. */
    inactive?: (at: 'start' | 'end') => void;
    /** One-shot on the frame the step becomes active. `at` is which end was entered from. */
    entering?: (at: 'start' | 'end') => void;
    /** Called every frame while the step is active. */
    active?: (progress: number) => void;
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
 * through enter/active/inactive lifecycle callbacks.
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
    const enterings: (((at: 'start' | 'end') => void) | undefined)[] = new Array(count);
    const actives: (((progress: number) => void) | undefined)[] = new Array(count);
    const inactives: (((at: 'start' | 'end') => void) | undefined)[] = new Array(count);

    // Per-step phase tracking for transition detection
    const prevPhase: number[] = new Array(count);

    for (let i = 0; i < count; i++) {
        stepRefs[i] = sequence.steps[keys[i]];
        const h = handlers[keys[i]]!;
        enterings[i] = h.entering;
        actives[i] = h.active;
        inactives[i] = h.inactive;
    }

    // Initialise: derive phase from current state, fire the matching callback
    for (let i = 0; i < count; i++) {
        const step = stepRefs[i];
        const phase = step.isActive ? ACTIVE : step.progress <= 0 ? BEFORE : AFTER;
        prevPhase[i] = phase;
        firePhaseEntry(i, phase, phase);
    }

    return function update(): void {
        for (let i = 0; i < count; i++) {
            const step = stepRefs[i];
            const phase = step.isActive ? ACTIVE : step.progress <= 0 ? BEFORE : AFTER;
            const prev = prevPhase[i];

            if (phase !== prev) {
                prevPhase[i] = phase;
                firePhaseEntry(i, phase, prev);
            }
            else if (phase === ACTIVE) {
                // Same phase, still active: dispatch progress
                actives[i]?.(stepRefs[i].progress);
            }
            // Same phase, before or after: no-op (rest state already set)
        }
    };

    function firePhaseEntry(i: number, phase: number, prev: number): void {
        if (phase === ACTIVE) {
            // Entering active: 'start' if coming from BEFORE, 'end' if from AFTER
            enterings[i]?.(prev === BEFORE ? 'start' : 'end');
            actives[i]?.(stepRefs[i].progress);
        }
        else {
            // Entering rest state: 'start' for BEFORE, 'end' for AFTER
            inactives[i]?.(phase === AFTER ? 'end' : 'start');
        }
    }
}
