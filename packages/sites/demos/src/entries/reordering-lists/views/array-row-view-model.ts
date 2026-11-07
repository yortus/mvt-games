/**
 * Presentation state for a row held as a plain array: each card eases toward
 * its position and fades in when it enters. The model knows about none of this.
 *
 * Cards move between indices when the row reorders, so state stored per index
 * would stay where the index is and a reorder could not animate. The state is
 * stored per card instead, by the card's dense id, and republished per index
 * each frame for the view to read. After a reorder each card is simply easing
 * toward a different target, so it slides there.
 *
 * What an array cannot give is an exit. A removed card is no longer in the
 * array, so there is nothing left to render it from: it vanishes, and the
 * cards after it slide over its gap.
 *
 * Per frame, per card, the loop costs one `idAt` call, one array index, one
 * comparison and some arithmetic. `update()` is a hot path, so the store is an
 * array indexed by dense id, never a hash map.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ArrayRowViewModel {
    /** Eased X of the card at `index`, relative to the row, in pixels. */
    xAt: (index: number) => number;
    alphaAt: (index: number) => number;
    scaleAt: (index: number) => number;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ArrayRowViewModelOptions {
    count: () => number;
    /** Must return a stable dense id per card, so the state can be array-indexed. */
    idAt: (index: number) => number;
    readonly pitchPx: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createArrayRowViewModel(options: ArrayRowViewModelOptions): ArrayRowViewModel {
    const { idAt, pitchPx } = options;

    // Presentation state per card, indexed by dense id.
    const cosmetics: CardCosmetic[] = [];

    // Republished per index each frame, so every view binding is one array read.
    const indexX: number[] = [];
    const indexAlpha: number[] = [];
    const indexScale: number[] = [];

    // Which cards were in the row at the last update, by id, and which are in
    // it at this one, so a card can tell that it is entering.
    let wasInRow: boolean[] = [];
    let isInRow: boolean[] = [];
    // A step of no time starts the cards already in the row entering, so the
    // first refresh, which can come before the first update, has state to read.
    update(0);

    return {
        xAt: (index) => indexX[index],
        alphaAt: (index) => indexAlpha[index],
        scaleAt: (index) => indexScale[index],
        update,
    };

    function update(deltaMs: number): void {
        isInRow.fill(false);
        const count = options.count();
        const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);

        for (let i = 0; i < count; i++) {
            const id = idAt(i);
            const targetX = i * pitchPx;

            let cosmetic = cosmetics[id];
            if (cosmetic === undefined) {
                cosmetic = { x: 0, alpha: 0, scale: 0 };
                cosmetics[id] = cosmetic;
            }

            // Not in the row last time, so it is entering: start it at its
            // target, small and transparent, rather than wherever it last was.
            if (wasInRow[id] !== true) {
                cosmetic.x = targetX;
                cosmetic.alpha = 0;
                cosmetic.scale = ENTRANCE_SCALE;
            }
            isInRow[id] = true;

            cosmetic.x += (targetX - cosmetic.x) * ease;
            cosmetic.alpha += (1 - cosmetic.alpha) * ease;
            cosmetic.scale += (1 - cosmetic.scale) * ease;

            indexX[i] = cosmetic.x;
            indexAlpha[i] = cosmetic.alpha;
            indexScale[i] = cosmetic.scale;
        }

        const lastRow = wasInRow;
        wasInRow = isInRow;
        isInRow = lastRow;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface CardCosmetic {
    x: number;
    alpha: number;
    scale: number;
}

const SMOOTH_MS = 110;
const ENTRANCE_SCALE = 0.4;
