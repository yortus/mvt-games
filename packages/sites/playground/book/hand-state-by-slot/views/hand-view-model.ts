import type { IndexedSlots, OrderedSlot } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How quickly the cards ease, in ms. Smaller is quicker. */
const SMOOTH_MS = 120;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Each card's eased position and fade, for a hand held in an
 * `OrderedSlotList`. The state is kept by storage slot, which a card keeps
 * for its whole life in the hand, so a `<List>` of the slots reads it by
 * the same index.
 */
export interface HandViewModel {
    /** Where the middle of the card in this storage slot is now, in pixels from the first card's place. */
    readonly xAt: (index: number) => number;
    readonly alphaAt: (index: number) => number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HandViewModelOptions {
    /** The hand's storage slots, read once. The model changes what's in them. */
    readonly slots: IndexedSlots<OrderedSlot<unknown>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the hand's presentation state, with each card in the hand already in its place. */
export function createHandViewModel(options: HandViewModelOptions): HandViewModel {
    const { slots } = options;

    // Each card's state, by its storage slot's index
    const cosmetics: SlotCosmetic[] = [];
    update(0); // so the first refresh has state to read

    return {
        xAt: (index) => cosmetics[index].x,
        alphaAt: (index) => cosmetics[index].alpha,
        update,
    };

    function update(deltaMs: number): void {
        const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);
        for (let i = 0; i < slots.length; i++) {
            const slot = slots.at(i);
            if (slot === undefined) continue;
            let cosmetic = cosmetics[i];
            if (cosmetic === undefined) {
                cosmetic = { owner: undefined, x: 0, alpha: 0 };
                cosmetics[i] = cosmetic;
            }
            // A different slot object means a new card in this storage slot
            if (cosmetic.owner !== slot) {
                cosmetic.owner = slot;
                cosmetic.x = Math.max(slot.ordinal, 0) * PITCH;
                cosmetic.alpha = 0;
            }

            if (slot.isLive) {
                cosmetic.x += (slot.ordinal * PITCH - cosmetic.x) * ease;
                cosmetic.alpha += (1 - cosmetic.alpha) * ease;
            }
            else {
                // Removed, waiting for release: fade out where it stands
                cosmetic.alpha += (0 - cosmetic.alpha) * ease;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SlotCosmetic {
    /** The slot this state was last updated for. A different one means a new card. */
    owner: OrderedSlot<unknown> | undefined;
    x: number;
    alpha: number;
}

/** The distance from one card's middle to the next, in pixels. */
const PITCH = 80;
