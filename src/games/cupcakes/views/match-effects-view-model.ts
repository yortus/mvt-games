import { createSequence, type Sequence } from '#common';
import type { StepDef } from '#common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MatchEffectsViewModel {
    /** The underlying match effect sequence. */
    readonly sequence: Sequence<'fade' | 'shake' | 'dust' | 'popup'>;
    /** Advance the sequence by deltaMs. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MatchEffectsViewModelBindings {
    getIsMatching(): boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Overlapping effect steps that play during a match sequence.
 *
 * ```
 * Time (ms):  0        100       200       250       350       500
 *             |---------|---------|---------|---------|---------|
 *  fade:      [=====================]                              0-250ms
 *  shake:        [=================]                               50-250ms
 *  dust:            [==========================]                   100-350ms
 *  popup:               [================================]         150-500ms
 * ```
 */
const MATCH_EFFECT_STEPS = [
    { name: 'fade',  startMs: 0,   durationMs: 250 },
    { name: 'shake', startMs: 50,  durationMs: 200 },
    { name: 'dust',  startMs: 100, durationMs: 250 },
    { name: 'popup', startMs: 150, durationMs: 350 },
] as const satisfies readonly StepDef[];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMatchEffectsViewModel(bindings: MatchEffectsViewModelBindings): MatchEffectsViewModel {
    const sequence = createSequence(MATCH_EFFECT_STEPS);
    let wasMatching = false;

    const viewModel: MatchEffectsViewModel = {
        get sequence() { return sequence; },

        update(deltaMs: number): void {
            const isMatching = bindings.getIsMatching();
            if (isMatching && !wasMatching) {
                sequence.start();
            }
            wasMatching = isMatching;
            sequence.update(deltaMs);
        },
    };

    return viewModel;
}
