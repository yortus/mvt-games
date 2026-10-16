import { CELEBRATION_OPENER_MS, CELEBRATION_STEP_MS } from '../data';
import type { WayWin } from './evaluate-ways';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** `'allWins'` is the opening step, showing every winning cell at once; each `'oneWin'` step shows one way. */
export type CelebrationStepKind = 'allWins' | 'oneWin';

/**
 * Shows off a spin's wins, a step at a time: an opener for all of them, then
 * each way in turn, once. Views read the step and its progress, and decide
 * what celebrating looks like.
 *
 * Leap-safe: a large `update` skips the steps it covers.
 */
export interface CelebrationModel {
    readonly isActive: boolean;
    /** The wins being celebrated, highest payout first. Empty when not active. */
    readonly wins: readonly WayWin[];
    /** Counts the steps: 0 for the opener, then 1 for `wins[0]`, and so on. -1 when not active. */
    readonly stepIndex: number;
    readonly stepKind: CelebrationStepKind;
    /** The way the step shows, in a `'oneWin'` step. Undefined otherwise. */
    readonly win: WayWin | undefined;
    /** How far through the step, from 0 to 1, rising steadily. */
    readonly progress: number;

    /** Start from the opener. Does nothing for no wins. */
    start: (wins: readonly WayWin[]) => void;
    /** End at once. */
    stop: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCelebrationModel(): CelebrationModel {
    let wins: readonly WayWin[] = NO_WINS;
    let stepIndex = -1;
    let stepElapsedMs = 0;

    const model: CelebrationModel = {
        get isActive() { return stepIndex >= 0; },
        get wins() { return wins; },
        get stepIndex() { return stepIndex; },
        get stepKind() { return stepIndex > 0 ? 'oneWin' : 'allWins'; },
        get win() { return stepIndex > 0 ? wins[stepIndex - 1] : undefined; },
        get progress() { return stepIndex < 0 ? 0 : stepElapsedMs / stepDurationMs(); },

        start(nextWins) {
            if (nextWins.length === 0) return;
            wins = nextWins;
            stepIndex = 0;
            stepElapsedMs = 0;
        },

        stop() {
            wins = NO_WINS;
            stepIndex = -1;
            stepElapsedMs = 0;
        },

        update(deltaMs) {
            if (stepIndex < 0) return;
            stepElapsedMs += deltaMs;
            while (stepElapsedMs >= stepDurationMs()) {
                stepElapsedMs -= stepDurationMs();
                stepIndex++;
                if (stepIndex > wins.length) {
                    model.stop();
                    return;
                }
            }
        },
    };

    return model;

    function stepDurationMs(): number {
        return stepIndex === 0 ? CELEBRATION_OPENER_MS : CELEBRATION_STEP_MS;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_WINS: readonly WayWin[] = [];
