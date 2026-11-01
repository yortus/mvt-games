// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How quickly the cards ease, in ms. Smaller is quicker. */
const SMOOTH_MS = 120;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Each card's eased position and fade, for a hand held as a plain array.
 * The state is kept by each card's dense id, so it moves with the card from
 * slot to slot, and copied out by position once per update, for the views
 * to read.
 */
export interface HandViewModel {
    /** Where the middle of the card at this place in the hand is now, in pixels from the first card's place. */
    readonly xAt: (index: number) => number;
    readonly alphaAt: (index: number) => number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HandViewModelOptions {
    /** How many cards are in the hand. */
    readonly count: () => number;
    /** The dense id of the card at this place in the hand. */
    readonly idAt: (index: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the hand's presentation state, with each card in the hand already in its place. */
export function createHandViewModel(options: HandViewModelOptions): HandViewModel {
    const { count, idAt } = options;

    // Each card's state, by the card's dense id
    const cosmetics: CardCosmetic[] = [];
    // Each position's state, copied from its card's once per update
    const xAtIndex: number[] = [];
    const alphaAtIndex: number[] = [];
    let frame = 0;
    update(0); // so the first refresh has state to read

    return {
        xAt: (index) => xAtIndex[index],
        alphaAt: (index) => alphaAtIndex[index],
        update,
    };

    function update(deltaMs: number): void {
        frame += 1;
        const n = count();
        const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);
        for (let i = 0; i < n; i++) {
            const id = idAt(i);
            const targetX = i * PITCH;
            let cosmetic = cosmetics[id];
            if (cosmetic === undefined) {
                cosmetic = { x: targetX, alpha: 0, seenFrame: -1 };
                cosmetics[id] = cosmetic;
            }
            // Not in the hand last frame, so it's arriving: start it in
            // its place, transparent, not wherever it last was
            if (cosmetic.seenFrame !== frame - 1) {
                cosmetic.x = targetX;
                cosmetic.alpha = 0;
            }
            cosmetic.seenFrame = frame;

            cosmetic.x += (targetX - cosmetic.x) * ease;
            cosmetic.alpha += (1 - cosmetic.alpha) * ease;
            xAtIndex[i] = cosmetic.x;
            alphaAtIndex[i] = cosmetic.alpha;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface CardCosmetic {
    x: number;
    alpha: number;
    /** The last frame this card was in the hand. */
    seenFrame: number;
}

/** The distance from one card's middle to the next, in pixels. */
const PITCH = 80;
