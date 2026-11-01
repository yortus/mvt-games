import { createReaction, createSequence, increased } from '@mvtjs/utils';
import { MATCH_STEPS } from './match-steps';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How much stronger each match in a chain makes the shake, in pixels, up to the most it can be. */
const SHAKE_PER_MATCH_PX = 4;
/** The most the shake can be, in pixels. */
const MAX_SHAKE_PX = 16;
/** How many times the board swings over the shake, in radians of a sine wave. */
const SHAKE_WAVES = 40;
/** The match in a chain from which the banner shows. */
const BANNER_FROM_CASCADE = 3;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The board's match effects, and the rules that tie them together. Each
 * match in a chain restarts the celebration, but the shake builds up from
 * one match to the next. The combo banner shows from the third match in a
 * chain, and stays until the chain ends. This holds no display objects, so
 * a test can check the rules without a renderer.
 */
export interface MatchEffectsViewModel {
    /** How far the board is shaken now, in pixels. */
    readonly shakePx: number;
    /** How far the score popup has risen and faded, from 0 to 1. */
    readonly popupProgress: number;
    /** True once this match's dust is due, until the next match. */
    readonly isDustDue: boolean;
    readonly isBannerShown: boolean;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MatchEffectsViewModelOptions {
    /** Matches made in a row in this chain, and 0 between chains. */
    readonly cascadeStep: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the match effects at rest, with no shake and no banner. */
export function createMatchEffectsViewModel(
    options: MatchEffectsViewModelOptions,
): MatchEffectsViewModel {
    const { cascadeStep } = options;
    const sequence = createSequence(MATCH_STEPS);
    let shakeStrengthPx = 0;
    let isBannerShown = false;

    const startCelebrationOnEachMatch = createReaction({
        watch: cascadeStep,
        when: increased,
        react: (step) => {
            sequence.start();
            shakeStrengthPx = Math.min(
                MAX_SHAKE_PX,
                shakeStrengthPx + SHAKE_PER_MATCH_PX,
            );
            if (step >= BANNER_FROM_CASCADE) isBannerShown = true;
        },
    });
    const endChainWhenCascadeResets = createReaction({
        watch: cascadeStep,
        when: 0,
        react: () => {
            shakeStrengthPx = 0;
            isBannerShown = false;
        },
    });

    return {
        get shakePx() {
            const { isActive, progress } = sequence.steps.shake;
            if (!isActive) return 0;
            const wave = Math.sin(progress * SHAKE_WAVES);
            return wave * shakeStrengthPx * (1 - progress);
        },
        get popupProgress() {
            return sequence.steps.popup.progress;
        },
        get isDustDue() {
            return sequence.steps.dust.progress > 0;
        },
        get isBannerShown() {
            return isBannerShown;
        },
        update: (deltaMs) => {
            startCelebrationOnEachMatch();
            endChainWhenCascadeResets();
            sequence.update(deltaMs);
        },
    };
}
