import type { DailyRecords } from './daily-records';
import { createWalkthroughModel, type WalkthroughModel, type WalkthroughStep } from './walkthrough-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What of the way in shows: nothing, the card that says how to play, or the walkthrough. */
export type IntroPhase = 'hidden' | 'card' | 'walkthrough';

/**
 * The way into a puzzle game, the same for every game on the site. A card
 * says how to play: the rules, over a small example, and the controls. It
 * shows as a player first opens the game, over its calendar, and again when
 * they ask. From the card, the player can play, or be shown how, in a
 * walkthrough on a practice puzzle. The practice puzzle stands in for the
 * puzzle open, if one is, until the walkthrough ends, and is never kept.
 */
export interface IntroModel<P, T> {
    readonly phase: IntroPhase;
    /** The practice puzzle, while the walkthrough plays. */
    readonly practice: P | undefined;
    readonly walkthrough: WalkthroughModel<T> | undefined;
    /** A count that rises as each walkthrough starts and ends, as the puzzle shown changes. */
    readonly practiceChanges: number;

    /** Shows the card that says how to play. */
    showCard: () => void;
    /** Shows the card, if the player has never put it away, in this game. For the game's opening. */
    showCardIfNew: () => void;
    /** Starts the walkthrough, on a new practice puzzle, from the card. */
    startWalkthrough: () => void;
    /** Puts the card or the walkthrough away, played or skipped. The card won't show by itself again. */
    close: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface IntroModelOptions<P, T> {
    /** The game's records, which keep whether the player has seen the way in. */
    readonly records: Pick<DailyRecords<string>, 'isIntroSeen' | 'markIntroSeen'>;
    /** Makes a new practice puzzle, for a walkthrough. */
    readonly createPractice: () => P;
    /** The walkthrough's steps, its last asking nothing. See `WalkthroughModelOptions`. */
    readonly steps: readonly WalkthroughStep<P, T>[];
    readonly findWhenChanged: readonly ((practice: P) => unknown)[];
    readonly isSameTarget: (a: T, b: T) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the way in, with nothing showing. */
export function createIntroModel<P, T>(options: IntroModelOptions<P, T>): IntroModel<P, T> {
    const { records } = options;
    let phase: IntroPhase = 'hidden';
    let practice: P | undefined;
    let walkthrough: WalkthroughModel<T> | undefined;
    let practiceChanges = 0;

    const intro: IntroModel<P, T> = {
        get phase() { return phase; },
        get practice() { return practice; },
        get walkthrough() { return walkthrough; },
        get practiceChanges() { return practiceChanges; },
        showCard() {
            endWalkthrough();
            phase = 'card';
        },
        showCardIfNew() {
            if (!records.isIntroSeen) intro.showCard();
        },
        startWalkthrough() {
            if (phase !== 'card') return;
            practice = options.createPractice();
            const { steps, findWhenChanged, isSameTarget } = options;
            walkthrough = createWalkthroughModel({ practice, steps, findWhenChanged, isSameTarget });
            practiceChanges++;
            phase = 'walkthrough';
        },
        close() {
            if (phase === 'hidden') return;
            endWalkthrough();
            phase = 'hidden';
            records.markIntroSeen();
        },
        update(deltaMs) {
            walkthrough?.update(deltaMs);
        },
    };
    return intro;

    function endWalkthrough(): void {
        if (practice === undefined) return;
        practice = undefined;
        walkthrough = undefined;
        practiceChanges++;
    }
}
